/*
 * Copyright © 2018 Lisk Foundation
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
// tslint:disable-next-line no-reference
/// <reference path="../../../types/browserify-bignum/index.d.ts" />
// See issue #912 for above reference

import * as cryptography from '@liskhq/lisk-cryptography';
import BigNum from 'browserify-bignum';
import { BYTESIZES, TRANSACTION_TYPES } from './constants';
import { TransactionError } from './errors';
import {
	Account,
	StateReturn,
	TransactionAsset,
	TransactionJSON,
	ValidateReturn,
	VerifyReturn,
} from './transaction_types';
import {
	checkBalance,
	normalizeInput,
	validateTransaction,
	verifyTransaction,
} from './utils';

export abstract class BaseTransaction {
	public readonly amount: BigNum;
	public readonly fee: BigNum;
	public readonly id: string;
	public readonly recipientId: string;
	public readonly recipientPublicKey: string;
	public readonly senderId: string;
	public readonly senderPublicKey: string;
	public readonly signature?: string;
	public readonly signatures: ReadonlyArray<string> = [];
	public readonly signSignature?: string;
	public readonly timestamp: number;
	public readonly type: number;
	public readonly asset: TransactionAsset = {};
	private applied = false;

	public constructor(rawTransaction: TransactionJSON) {
		normalizeInput(rawTransaction);
		this.amount = new BigNum(rawTransaction.amount);
		this.asset = rawTransaction.asset;
		this.fee = new BigNum(rawTransaction.fee);
		this.id = rawTransaction.id;
		this.recipientId = rawTransaction.recipientId;
		this.recipientPublicKey = rawTransaction.recipientPublicKey;
		this.senderId = rawTransaction.senderId;
		this.senderPublicKey = rawTransaction.senderPublicKey;
		this.signature = rawTransaction.signature;
		this.signatures = rawTransaction.signatures;
		this.signSignature = rawTransaction.signSignature;
		this.timestamp = rawTransaction.timestamp;
		this.type = rawTransaction.type;
	}

	public abstract prepareTransaction(
		passphrase: string,
		secondPassphrase?: string,
	): TransactionJSON;

	public toJSON(): TransactionJSON {
		const transaction = {
			id: this.id,
			amount: this.amount.toString(),
			type: this.type,
			timestamp: this.timestamp,
			senderPublicKey: this.senderPublicKey,
			senderId: this.senderId,
			recipientId: this.recipientId,
			recipientPublicKey: this.recipientPublicKey,
			fee: this.fee.toString(),
			signatures: this.signatures,
			asset: this.asset,
		};

		if (!(typeof this.signature === 'string' && this.signature.length > 0)) {
			return transaction;
		}

		const singleSignedTransaction = {
			...transaction,
			signature: this.signature,
		};

		if (
			!(typeof this.signSignature === 'string' && this.signSignature.length > 0)
		) {
			return singleSignedTransaction;
		}

		const signedTransaction = {
			...singleSignedTransaction,
			signSignature: this.signSignature,
		};

		return signedTransaction;
	}

	public getBytes(): Buffer {
		const { signature, signSignature } = this.toJSON();
		const transactionType = Buffer.alloc(BYTESIZES.TYPE, this.type);
		const transactionTimestamp = Buffer.alloc(BYTESIZES.TIMESTAMP);
		transactionTimestamp.writeIntLE(this.timestamp, 0, BYTESIZES.TIMESTAMP);

		const transactionSenderPublicKey = cryptography.hexToBuffer(
			this.senderPublicKey,
		);

		const transactionRecipientID = this.recipientId
			? cryptography.bigNumberToBuffer(
					this.recipientId.slice(0, -1),
					BYTESIZES.RECIPIENT_ID,
			  )
			: Buffer.alloc(BYTESIZES.RECIPIENT_ID);

		const amountBigNum = new BigNum(this.amount);

		const transactionAmount = amountBigNum.toBuffer({
			endian: 'little',
			size: BYTESIZES.AMOUNT,
		});

		const transactionSignature = signature
			? cryptography.hexToBuffer(signature)
			: Buffer.alloc(0);

		const transactionSecondSignature = signSignature
			? cryptography.hexToBuffer(signSignature)
			: Buffer.alloc(0);

		return Buffer.concat([
			transactionType,
			transactionTimestamp,
			transactionSenderPublicKey,
			transactionRecipientID,
			transactionAmount,
			transactionSignature,
			transactionSecondSignature,
		]);
	}

	public abstract containsUniqueData(): boolean;

	public validate(): ValidateReturn {
		const transaction = this.toJSON();

		if (!TRANSACTION_TYPES.includes(transaction.type)) {
			return {
				validated: false,
				errors: [new TransactionError('Invalid transaction type.')],
			};
		}

		// Schema validation
		const { valid, errors } = validateTransaction(transaction);
		const transactionErrors = errors
			? errors.map(
					error =>
						new TransactionError(
							`'${error.dataPath}' ${error.message}`,
							error.dataPath,
						),
			  )
			: undefined;

		// Single signature validation
		if (!transaction.signature) {
			return {
				validated: false,
				errors: [
					new TransactionError(
						'Cannot validate transaction without signature.',
					),
				],
			};
		}

		const verified = verifyTransaction(transaction);

		return {
			validated: valid && verified,
			errors: transactionErrors,
		};
	}

	public getRequiredAttributes(): object {
		return {
			ACCOUNTS: [cryptography.getAddressFromPublicKey(this.senderPublicKey)],
		};
	}

	public verifyAgainstState(sender: Account): VerifyReturn {
		// Check sender balance
		const { exceeded, errors } = checkBalance(sender, this.fee);

		// Check multisig
		const verified = sender.secondPublicKey
			? verifyTransaction(this.toJSON(), sender.secondPublicKey)
			: true;

		return {
			verified: !exceeded && verified,
			errors,
		};
	}

	public abstract verifyAgainstOtherTransactions(
		transactions: ReadonlyArray<TransactionJSON>,
	): VerifyReturn;

	public apply(sender: Account): StateReturn {
		if (this.applied) {
			return {
				sender,
			};
		}

		const updatedBalance = new BigNum(sender.balance).sub(this.fee);
		const updatedAccount = { ...sender, balance: updatedBalance.toString() };
		this.applied = true;

		return {
			sender: updatedAccount,
		};
	}

	public undo(sender: Account): StateReturn {
		if (!this.applied) {
			return {
				sender,
			};
		}
		const updatedBalance = new BigNum(sender.balance).add(this.fee);
		const updatedAccount = { ...sender, balance: updatedBalance.toString() };

		return {
			sender: updatedAccount,
		};
	}
}