/* tslint:disable:no-console */
import { expect } from 'chai';

import { P2P } from '../../src';

describe('#Good peers test', () => {
	describe('get a good peer list with options', () => {
		const lisk = new P2P();
		it('should be an object', () => {
			return expect(lisk).to.be.an('object');
		});
		it('should be an instance of P2P blockchain', () => {
			return expect(lisk)
				.to.be.an('object')
				.and.be.instanceof(P2P);
		});
	});

	describe('Get list of n number of good peers', () => {
		const lisk = new P2P();
		it('should be an object', () => {
			return expect(lisk).to.be.an('object');
		});
	});
});