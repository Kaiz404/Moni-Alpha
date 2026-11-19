// Birth years for flows/account/sign-up-age.yaml, from today's year so the flow never goes stale.
// The year picker opens on the decade of someone turning 18 this year. The first year of the next
// decade is always later than that, so a birth that year is under 18 in any month.
var adultYear = new Date().getFullYear() - 18;
var nextDecade = Math.floor(adultYear / 10) * 10 + 10;
output.openDecade = nextDecade - 10 + 's';
output.nextDecade = nextDecade + 's';
output.underAgeYear = String(nextDecade);
