import { loadPrototype } from "./prototype.mjs";
const P = loadPrototype("2027-03-15");
P.state.rows = [{id:"a",section:"s05",date:"2026-08-01",paid:"2026-08-10",owner:"Ee",direction:"income",amount:1100,gst:100}];
P.setFY(2027);
console.log(JSON.stringify(P.businessTotals(["Ee"]), (k,v)=>k==="rows"?undefined:v), P.quarters()[0], P.rate("wfh"));
