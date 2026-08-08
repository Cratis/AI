// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { computeNewOrder } from '../issueOrdering';

describe('when computing new order', () => {
    it('should place a row between its ordered neighbors at the midpoint', () => {
        computeNewOrder([{ order: 10 }, { order: undefined }, { order: 20 }], 1).should.equal(15);
    });

    it('should place a row dropped at the top below the next row', () => {
        computeNewOrder([{ order: undefined }, { order: 10 }], 0).should.equal(10 - 1024);
    });

    it('should place a row dropped at the bottom above the previous row', () => {
        computeNewOrder([{ order: 10 }, { order: undefined }], 1).should.equal(10 + 1024);
    });

    it('should use zero for a single row', () => {
        computeNewOrder([{ order: undefined }], 0).should.equal(0);
    });
});
