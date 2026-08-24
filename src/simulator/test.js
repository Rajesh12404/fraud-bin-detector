// test.js
// Quick sanity check to make sure our generator works

const { generateGenuineTransaction, generateAttackBurst } = require('./generator');

const sampleTransaction = generateGenuineTransaction(Date.now());
console.log('--- Sample GENUINE transaction ---');
console.log(sampleTransaction);

const attackBurst = generateAttackBurst(Date.now());
console.log('\n--- Sample ATTACK burst ---');
console.log('Number of transactions in this burst:', attackBurst.length);
console.log('First transaction in burst:');
console.log(attackBurst[0]);
console.log('Second transaction in burst:');
console.log(attackBurst[1]);
const { generateBankOutageBurst, generateFlashSaleBurst } = require('./generator');

const outageBurst = generateBankOutageBurst(Date.now());
console.log('\n--- Sample BANK OUTAGE burst ---');
console.log('Number of transactions:', outageBurst.length);
console.log('First transaction:');
console.log(outageBurst[0]);

const flashSaleBurst = generateFlashSaleBurst(Date.now());
console.log('\n--- Sample FLASH SALE burst ---');
console.log('Number of transactions:', flashSaleBurst.length);
console.log('First transaction:');
console.log(flashSaleBurst[0]);