/* made-up example cases (not real people) */
(function (root) {
  var S = {
    A: { label: 'Example A (made-up): California, 50/50, house kept by one spouse', state: 'CA', pctA: 50, nameA: 'Alex', nameB: 'Blake', ti: 22, tcg: 15, excl: 250000,
      items: [
        { name: 'Family home', kind: 'home', value: 640000, basis: 410000, keep: 'A' },
        { name: 'Mortgage on the home', kind: 'debt', value: 385000, keep: 'A' },
        { name: 'Joint checking', kind: 'cash', value: 18000, keep: 'B' },
        { name: "Alex's 401(k)", kind: 'pretax', value: 212000, keep: 'A' },
        { name: "Blake's Roth IRA", kind: 'roth', value: 48000, keep: 'B' },
        { name: 'Brokerage account', kind: 'taxable', value: 96000, basis: 60000, keep: 'B' },
        { name: "Alex's car", kind: 'vehicle', value: 24000, keep: 'A' },
        { name: "Blake's car", kind: 'vehicle', value: 17000, keep: 'B' },
        { name: 'Credit card', kind: 'debt', value: 9400, keep: 'B' },
        { name: "Blake's inheritance account", kind: 'cash', value: 55000, sepOwner: 'B', keep: 'B' }
      ] },
    B: { label: 'Example B (made-up): Pennsylvania, 45/55, house sold, part of a 401(k) earned before the wedding', state: 'PA', pctA: 45, nameA: 'Jordan', nameB: 'Sam', ti: 24, tcg: 15, excl: 250000,
      items: [
        { name: 'House (to be sold)', kind: 'home', value: 410000, basis: 300000, keep: 'sell' },
        { name: 'Mortgage (paid from the sale)', kind: 'debt', value: 220000, keep: 'sell' },
        { name: "Jordan's 401(k)", kind: 'pretax', value: 180000, sep: 40000, sepOwner: 'A', keep: 'A' },
        { name: "Sam's brokerage", kind: 'taxable', value: 60000, basis: 58000, keep: 'B' },
        { name: 'Savings', kind: 'cash', value: 30000, keep: 'B' },
        { name: "Jordan's car", kind: 'vehicle', value: 12000, keep: 'A' },
        { name: 'Credit card', kind: 'debt', value: 6000, keep: 'A' },
        { name: "Sam's student loan (taken before the wedding)", kind: 'debt', value: 30000, sepOwner: 'B', keep: 'B' }
      ] }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.DAD_SAMPLES = S;
})(this);
