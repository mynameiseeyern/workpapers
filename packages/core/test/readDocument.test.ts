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

  it("reads a payslip for the pay it covers, not the year to date, so each payslip can be its own record", () => {
    const text = `
      Example Employer Pty Ltd
      Pay date 30/06/2026
      Description        This pay      Year to date
      Gross pay          3,326.92      86,500.00
      PAYG tax             780.00      20,280.00
      Superannuation       382.60       9,947.50
      Net pay            2,546.92      66,220.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.gross).toBe(332692);
    expect(r.details.withheld).toBe(78000);
    expect(r.details.sg).toBe(38260);
    expect(r.date).toBe("2026-06-30");
  });

  it("reads a payslip laid out as rows of headings with the figures underneath", () => {
    // The layout of a common payroll provider's payslip. Every name and figure here is made up.
    const text = `
      Sam Sample
      1 Example Street
      Pay Period Pay Date Emp No. Status Pay Point
      01/08/2026 - 31/08/2026 20/08/2026 123 Full Time EXAMPLE EMPLOYER
      Payer Name Payer ABN
      EXAMPLE EMPLOYER PTY LTD 00000000000
      Elements
      Description Hours Rate Value
      NORMAL 0.000 0.0000 8000.00
      Allowances & Contributions
      Description Fund Name Value
      EXAMPLE SUPER FUND 960.00
      Deductions
      Description Fund Name Value
      SPIN SAL SAC EXAMPLE Super -500.00
      Summary of Earnings
      Gross Taxable Income Post Tax Earnings Post Tax Deductions Tax Net Income
      8000.00 7500.00 0.00 0.00 -1700.00 5800.00
      Pay Disbursement Details
      Method BSB Account No. Bank Amount
      EFT1 000-000 00000000 EXAMPLE BANK 5800.00
      Year to Date Details
      YTD Gross YTD Taxable Income YTD Deductions YTD Tax YTD Net
      16000.00 15000.00 -1000.00 -3400.00 11600.00
      YTD Allowances/Contributions/Deductions
      Description Member No. Amount
      EXAMPLE Super (SPIN SAL SAC) 1234567 1000.00
      EXAMPLE SUPER FUND 1234567 1920.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.gross).toBe(750000);       // taxable income: gross less the salary sacrifice, as the income statement shows it
    expect(r.details.withheld).toBe(170000);    // the Tax column, not net pay and not the year to date
    expect(r.details.resc).toBe(50000);
    expect(r.details.sg).toBe(96000);
    expect(r.date).toBe("2026-08-20");          // the pay date, not the start of the pay period
    expect(r.party).toBe("EXAMPLE EMPLOYER PTY LTD");
  });

  it("leaves tax withheld empty rather than fill in something as large as the pay", () => {
    const r = readFigures("Example Employer Pty Ltd\nGross pay 3,326.92\nTax 3,326.92", { section: "i01" });
    expect(r.details.gross).toBe(332692);
    expect(r.details.withheld).toBeUndefined();
  });

  it("passes over year-to-date figures printed on the same line or under their own label", () => {
    const text = `
      Example Employer Pty Ltd
      Gross pay 3,326.92 YTD 86,500.00
      YTD Tax 20,280.00
      Tax 780.00`;
    const r = readFigures(text, { section: "i01" });
    expect(r.details.gross).toBe(332692);
    expect(r.details.withheld).toBe(78000);
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
    expect(r.details.resc).toBe(20000);
    expect(r.details.sg).toBe(38260);
    expect(r.details.gross).toBe(312692);       // the taxable figure: what the income statement will show
    expect(r.details.withheld).toBe(71000);
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
