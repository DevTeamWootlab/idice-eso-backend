import { authenticator } from '@otplib/preset-default'; 
const secret = process.argv[2];

if (!secret) {
  console.error('Usage: yarn totp <secret>');
  process.exit(1);
}

const code = authenticator.generate(secret);
 const stepSeconds = 30;
 const currentUnixSeconds = Math.floor(Date.now() / 1000);
 const remainingSeconds = stepSeconds - (currentUnixSeconds % stepSeconds);

 console.log(`\n Current TOTP Access Token: [ ${code} ]`);
 console.log(
   `⏱️ Telemetry Window: Valid for the next ${remainingSeconds} seconds.`,
 );

console.log(`Code: ${code}  (valid for ${remainingSeconds}s)`);
