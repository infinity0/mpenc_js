/**
 * @fileOverview
 * Test of the `mpenc` core module.
 */

/*
 * Created: 27 Aug 2014 Guy K. Kloss <gk@mega.co.nz>
 *
 * (c) 2014 by Mega Limited, Wellsford, New Zealand
 *     http://mega.co.nz/
 *
 * This file is part of the multi-party chat encryption suite.
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation. See the accompanying
 * LICENSE file or <https://www.gnu.org/licenses/> if it is unavailable.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

define([
    "mpenc",
    "chai",
], function(ns, chai) {
    "use strict";

    var assert = chai.assert;

    describe("mpenc core module", function() {
        describe('namespace', function() {
            it('coded sub-module', function() {
                assert.notStrictEqual(ns.codec, undefined);
            });

            it('handler sub-module', function() {
                assert.notStrictEqual(ns.handler, undefined);
            });

            it('version sub-module', function() {
                assert.notStrictEqual(ns.version, undefined);
            });

            it('debug sub-module', function() {
                assert.notStrictEqual(ns.debug, undefined);
            });
        });
    });
});