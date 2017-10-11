/*
 * Copyright © 2017 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
import transferIntoDapp from '../../src/transactions/6_transferIntoDapp';
import cryptoModule from '../../src/crypto';

const time = require('../../src/transactions/utils/time');

afterEach(() => sandbox.restore());

describe('#transferIntoDapp transaction', () => {
	const dappId = '1234213';
	const secret = 'secret';
	const secondSecret = 'secondSecret';
	const publicKey = '5d036a858ce89f844491762eb89e2bfbd50a4a0a0da658e4b2628b25b117ae09';
	const secondPublicKey = '8b509500d5950122b3e446189b4312805515c8e7814a409e09ac5c21935564af';
	const amount = 10e8;
	const sendFee = 0.1e8;
	const timeWithOffset = 38350076;
	const offset = -10;

	let getTimeWithOffsetStub;
	let transferIntoDappTransaction;

	beforeEach(() => {
		getTimeWithOffsetStub = sandbox.stub(time, 'getTimeWithOffset').returns(timeWithOffset);
	});

	describe('with one secret', () => {
		beforeEach(() => {
			transferIntoDappTransaction = transferIntoDapp({ dappId, amount, secret });
		});

		it('should create an inTransfer dapp transaction', () => {
			(transferIntoDappTransaction).should.be.ok();
		});

		it('should use time.getTimeWithOffset to get the time for the timestamp', () => {
			(getTimeWithOffsetStub.calledWithExactly(undefined)).should.be.true();
		});

		it('should use time.getTimeWithOffset with an offset of -10 seconds to get the time for the timestamp', () => {
			transferIntoDapp({ dappId, amount, secret, timeOffset: offset });

			(getTimeWithOffsetStub.calledWithExactly(offset)).should.be.true();
		});

		describe('returned inTransfer transaction object', () => {
			it('should be an object', () => {
				(transferIntoDappTransaction).should.be.type('object');
			});

			it('should have id string', () => {
				(transferIntoDappTransaction).should.have.property('id').and.be.type('string');
			});

			it('should have type number equal to 6', () => {
				(transferIntoDappTransaction).should.have.property('type').and.be.type('number').and.equal(6);
			});

			it('should have amount number equal to 10 LSK', () => {
				(transferIntoDappTransaction).should.have.property('amount').and.be.type('number').and.equal(amount);
			});

			it('should have fee number equal to 0.1 LSK', () => {
				(transferIntoDappTransaction).should.have.property('fee').and.be.type('number').and.equal(sendFee);
			});

			it('should have recipientId equal to null', () => {
				(transferIntoDappTransaction).should.have.property('recipientId').be.null();
			});

			it('should have senderPublicKey hex string equal to sender public key', () => {
				(transferIntoDappTransaction).should.have.property('senderPublicKey').and.be.hexString().and.equal(publicKey);
			});

			it('should have timestamp number equal to result of time.getTimeWithOffset', () => {
				(transferIntoDappTransaction).should.have.property('timestamp').and.be.type('number').and.equal(timeWithOffset);
			});

			it('should have signature hex string', () => {
				(transferIntoDappTransaction).should.have.property('signature').and.be.hexString();
			});

			it('should be signed correctly', () => {
				const result = cryptoModule.verifyTransaction(transferIntoDappTransaction);
				(result).should.be.ok();
			});

			it('should not be signed correctly if modified', () => {
				transferIntoDappTransaction.amount = 100;
				const result = cryptoModule.verifyTransaction(transferIntoDappTransaction);
				(result).should.be.not.ok();
			});

			it('should have an asset object', () => {
				(transferIntoDappTransaction).should.have.property('asset').and.be.type('object');
			});

			describe('asset', () => {
				it('should have the in transfer dapp id', () => {
					(transferIntoDappTransaction.asset)
						.should.have.property('inTransfer')
						.with.property('dappId')
						.and.be.equal(dappId);
				});
			});
		});
	});

	describe('with second secret', () => {
		beforeEach(() => {
			transferIntoDappTransaction = transferIntoDapp({ dappId, amount, secret, secondSecret });
		});

		it('should create an transfer into dapp transaction with a second secret', () => {
			const transferIntoDappTransactionWithoutSecondSecret = transferIntoDapp({
				dappId,
				amount,
				secret,
			});
			(transferIntoDappTransaction).should.be.ok();
			(transferIntoDappTransaction).should.not.be.equal(
				transferIntoDappTransactionWithoutSecondSecret,
			);
		});

		describe('returned inTransfer dapp transaction', () => {
			it('should have second signature hex string', () => {
				(transferIntoDappTransaction).should.have.property('signSignature').and.be.hexString();
			});

			it('should be second signed correctly', () => {
				const result = cryptoModule.verifyTransaction(transferIntoDappTransaction, secondPublicKey);
				(result).should.be.ok();
			});

			it('should not be second signed correctly if modified', () => {
				transferIntoDappTransaction.amount = 100;
				const result = cryptoModule.verifyTransaction(transferIntoDappTransaction, secondPublicKey);
				(result).should.not.be.ok();
			});
		});
	});
});
