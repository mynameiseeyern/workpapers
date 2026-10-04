import { describe, expect, it } from "vitest";
import { readFigures } from "../src";

// Every document below is made up.

describe("readFigures", () => {
  it("reads a dividend statement laid out as a table", () => {
    const text = `
      Tasman Index Fund Limited
      ABN 00 000 000 000
      Dividend Statement
      Payment Date: 14 September 2026
      Class Description   Rate per Security   Participating Securities   Franked Amount   Unfranked Amount   Gross Payment
      Ordinary Shares   62 cents   500   $413.10   $182.40   $595.50
      Franking Credit $177.04
      Net Payment $595.50`;
    const r = readFigures(text, { section: "i11" });
    expect(r.details).toEqual({ franked: 41310, unfranked: 18240, credit: 17704 });
    expect(r.date).toBe("2026-09-14");
    expect(r.party).toBe("Tasman Index Fund Limited");
  });

  it("reads a dividend statement laid out as labels and figures, and prefers a name used before", () => {
    const text = `
      COASTAL MUTUAL
      Record date 01/07/2026
      Payment date 21/07/2026
      Unfranked amount: $0.00
      Franked amount: $268.80
      Franking credits: $115.20
      TFN withholding tax: $0.00`;
    const r = readFigures(text, { section: "i11", known: ["Harbourline Property Trust", "Coastal Mutual"] });
    expect(r.details).toEqual({ unfranked: 0, franked: 26880, credit: 11520, withheld: 0 });
    expect(r.date).toBe("2026-07-21");
    expect(r.party).toBe("Coastal Mutual");
  });

  it("reads a bank interest summary", () => {
    const text = `
      Harbourline Savings Pty Ltd
      Interest summary for the year ended 30 June 2026
      Account 000-000 0000000
      Total interest paid   $1,250.00
      TFN withholding tax   $0.00`;
    const r = readFigures(text, { section: "i10" });
    expect(r.details).toEqual({ gross: 125000, withheld: 0 });
    expect(r.date).toBe("2026-06-30");
    expect(r.party).toBe("Harbourline Savings Pty Ltd");
  });

  it("reads a tax invoice: the total including GST, the GST, the date and the supplier", () => {
    const text = `
      TAX INVOICE
      Example Stationery Co Pty Ltd  ABN 00 000 000 000
      Bill to:
      Somebody Else Pty Ltd
      Invoice date: 12/08/2026      Invoice no. 0001
      Notebook x 2      20.00
      Pens              10.00
      Subtotal (ex GST)        $30.00
      GST 10%                   $3.00
      Total (inc. GST)         $33.00
      Amount due                $0.00`;
    const r = readFigures(text, { section: "s07" });
    expect(r.amount).toBe(3300);
    expect(r.gst).toBe(300);
    expect(r.date).toBe("2026-08-12");
    expect(r.party).toBe("Example Stationery Co Pty Ltd");
  });

  it("reads a shop receipt that only says the total includes GST", () => {
    const text = `
      EXAMPLE HARDWARE
      2 Sep 2026 14:02
      Drill bits   24.95
      Extension lead   30.05
      SUBTOTAL   55.00
      TOTAL   $55.00
      Total includes GST of $5.00
      EFTPOS   55.00`;
    const r = readFigures(text, { section: "s05", known: ["Example Hardware"] });
    expect(r.amount).toBe(5500);
    expect(r.gst).toBe(500);
    expect(r.date).toBe("2026-09-02");
    expect(r.party).toBe("Example Hardware");
  });

  it("takes the year-to-date column on a payslip", () => {
    const text = `
      Example Employer Pty Ltd
      Pay date 30/06/2026
      Description        This pay      Year to date
      Gross pay          3,326.92      86,500.00
      PAYG tax             780.00      20,280.00
      Superannuation       382.60       9,947.50
      Net pay            2,546.92      66,220.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.gross).toBe(8650000);
    expect(r.details.withheld).toBe(2028000);
    expect(r.details.sg).toBe(994750);
    expect(r.date).toBe("2026-06-30");
  });

  it("puts salary-sacrificed super with reportable employer super, not with the employer's own super", () => {
    const text = `
      Example Employer Pty Ltd
      Pay date 30/06/2026
      Description                  This pay      Year to date
      Gross pay                    3,326.92      86,500.00
      Salary sacrifice - super      -200.00      -5,200.00
      Taxable gross                3,126.92      81,300.00
      PAYG tax                       710.00      18,460.00
      Superannuation guarantee       382.60       9,947.50
      Net pay                      2,416.92      62,840.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.resc).toBe(520000);
    expect(r.details.sg).toBe(994750);
    expect(r.details.gross).toBe(8130000);      // the taxable figure: what the income statement will show
    expect(r.details.withheld).toBe(1846000);
  });

  it("reads salary sacrifice however the payslip words it", () => {
    const read = (line: string) => readFigures(`Example Employer Pty Ltd\n${line}\nSuperannuation 9,947.50`, { section: "i01" }).details;
    for (const line of ["Salary sacrifice 5,200.00", "Super salary sacrifice $5,200.00", "Sal Sac Super 5,200.00",
      "Pre-tax super contribution 5,200.00", "Salary sacrificed superannuation (5,200.00)"]) {
      expect(read(line).resc, line).toBe(520000);
      expect(read(line).sg, line).toBe(994750);
    }
  });

  it("doesn't take a salary-sacrificed car, or after-tax super, as reportable super", () => {
    const read = (line: string) => readFigures(`Example Employer Pty Ltd\n${line}\nTax 18,460.00\nSuperannuation 9,947.50`, { section: "i01" }).details;
    for (const line of ["Salary sacrifice - novated lease 7,800.00", "Salary sacrifice car 7,800.00", "Post-tax super contribution 2,600.00"]) {
      expect(read(line).resc, line).toBeUndefined();
      expect(read(line).sg, line).toBe(994750);
      expect(read(line).withheld, line).toBe(1846000);
    }
  });

  it("keeps reportable employer super out of the employer super box on an income statement", () => {
    const text = `
      Example Employer Pty Ltd
      Gross payments   $81,300.00
      Tax withheld   $18,460.00
      Reportable employer superannuation contributions   $5,200.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.resc).toBe(520000);
    expect(r.details.sg).toBeUndefined();
  });

  it("reads a private health insurance statement", () => {
    const text = `
      Example Health Fund Limited
      Private health insurance statement 1 July 2025 to 30 June 2026
      Your premiums eligible for Australian Government rebate   $2,410.00
      Your Australian Government rebate received   $590.45
      Benefit code 30`;
    const r = readFigures(text, { section: "h01" });
    expect(r.details).toEqual({ premiums: 241000, rebate: 59045 });
  });

  it("uses the document's total for a schedule with a single Amount box", () => {
    const text = `Example Super Fund\nContribution receipt\nDate 15 March 2026\nPersonal contribution\nTotal $5,000.00`;
    const r = readFigures(text, { section: "d12" });
    expect(r.details).toEqual({ amount: 500000 });
    expect(r.date).toBe("2026-03-15");
  });

  it("does not mistake years, quantities, percentages or account numbers for money", () => {
    const text = `Invoice 2026 for 3 items at 10% on account 12 345 678\nTotal $40.00`;
    const r = readFigures(text, { section: "s07" });
    expect(r.amount).toBe(4000);
    expect(r.gst).toBeUndefined();
  });

  it("leaves everything blank when there is nothing to read", () => {
    const r = readFigures("thank you for shopping with us", { section: "s07" });
    expect(r.amount).toBeUndefined();
    expect(r.gst).toBeUndefined();
    expect(r.date).toBeUndefined();
    expect(r.party).toBeUndefined();
    expect(r.details).toEqual({});
  });
});
