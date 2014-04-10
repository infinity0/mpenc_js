/**
 * @fileOverview
 * Test of the `mpenc/handler` module.
 */

/*
 * Created: 27 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
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
    "mpenc/handler",
    "mpenc/helper/utils",
    "mpenc/codec",
    "mpenc/version",
    "chai",
    "sinon/assert",
    "sinon/sandbox",
    "sinon/spy",
    "sinon/stub",
], function(ns, utils, codec, version,
        chai, sinon_assert, sinon_sandbox, sinon_spy, stub) {
    "use strict";

    var assert = chai.assert;

    var _echo = function(x) { return x; };

    // set test data
    _td.DATA_MESSAGE_CONTENT.protocol = version.PROTOCOL_VERSION;

    // Create/restore Sinon stub/spy/mock sandboxes.
    var sandbox = null;

    beforeEach(function() {
        sandbox = sinon_sandbox.create();
    });

    afterEach(function() {
        sandbox.restore();
    });

    function _stripProtoFromMessage(message) {
        var _PROTO_STRING = '?mpENC:';
        if (!message) {
            return null;
        }
        return atob(message.substring(_PROTO_STRING.length, message.length -1));
    }

    function _getPayload(message, senderParticipant) {
        if (message) {
            var content = codec.categoriseMessage(_stripProtoFromMessage(message.message)).content;
            if (senderParticipant) {
                return codec.decodeMessageContent(content,
                                                  senderParticipant.cliquesMember.groupKey.substring(0, 16),
                                                  senderParticipant.askeMember.ephemeralPubKey);
            } else {
                return codec.decodeMessageContent(content);
            }
        } else {
            return null;
        }
    }

    describe("ProtocolHandler class", function() {
        describe('constructor', function() {
            it('fails for missing params', function() {
                assert.throws(function() { new ns.ProtocolHandler('42', _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY); },
                              "Constructor call missing required parameters.");
            });

            it('just make an instance', function() {
                var handler = new ns.ProtocolHandler('42',
                                                     _td.RSA_PRIV_KEY,
                                                     _td.RSA_PUB_KEY,
                                                     _td.STATIC_PUB_KEY_DIR);
                assert.strictEqual(handler.id, '42');
                assert.ok(handler.staticPubKeyDir.get('3'));
                assert.deepEqual(handler.askeMember.staticPrivKey, _td.RSA_PRIV_KEY);
                assert.ok(handler.askeMember.staticPubKeyDir);
                assert.ok(handler.cliquesMember);
            });
        });

        describe('#_mergeMessages() method', function() {
            it('fail for mismatching senders', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var cliquesMessage = {source: '1', dest: '2', agreement: 'ika', flow: 'upflow',
                                      members: ['1', '2', '3', '4', '5', '6'], intKeys: null};
                var askeMessage = {source: '2', dest: '2', flow: 'upflow',
                                   members: ['1', '2', '3', '4', '5', '6'],
                                   nonces: null, pubKeys: null, sessionSignature: null};
                assert.throws(function() { participant._mergeMessages(cliquesMessage, askeMessage); },
                              "Message source mismatch, this shouldn't happen.");
            });

            it('fail for mismatching receivers', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var cliquesMessage = {source: '1', dest: '2', agreement: 'ika', flow: 'upflow',
                                      members: ['1', '2', '3', '4', '5', '6'], intKeys: null};
                var askeMessage = {source: '1', dest: '', flow: 'upflow',
                                   members: ['1', '2', '3', '4', '5', '6'],
                                   nonces: null, pubKeys: null, sessionSignature: null};
                assert.throws(function() { participant._mergeMessages(cliquesMessage, askeMessage); },
                              "Message destination mismatch, this shouldn't happen.");
            });

            it('merge the messages', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var cliquesMessage = {source: '1', dest: '2', agreement: 'ika', flow: 'upflow',
                                      members: ['1', '2', '3', '4', '5', '6'], intKeys: null};
                var askeMessage = {source: '1', dest: '2', flow: 'upflow',
                                   members: ['1', '2', '3', '4', '5', '6'],
                                   nonces: null, pubKeys: null, sessionSignature: null};
                var message = participant._mergeMessages(cliquesMessage, askeMessage);
                assert.strictEqual(message.source, cliquesMessage.source);
                assert.strictEqual(message.dest, cliquesMessage.dest);
                assert.strictEqual(message.flow, cliquesMessage.flow);
                assert.strictEqual(message.agreement, 'initial');
                assert.deepEqual(message.members, cliquesMessage.members);
                assert.deepEqual(message.intKeys, cliquesMessage.intKeys);
                assert.deepEqual(message.nonces, askeMessage.nonces);
                assert.deepEqual(message.pubKeys, askeMessage.pubKeys);
                assert.strictEqual(message.sessionSignature, askeMessage.sessionSignature);
            });

            it('merge the messages for ASKE only', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var askeMessage = {source: '3', dest: '', flow: 'downflow',
                                   members: ['1', '2', '3', '4', '5', '6'],
                                   nonces: null, pubKeys: null, sessionSignature: null,
                                   signingKey: null};
                var message = participant._mergeMessages(null, askeMessage);
                assert.strictEqual(message.source, '1');
                assert.strictEqual(message.dest, askeMessage.dest);
                assert.strictEqual(message.flow, askeMessage.flow);
                assert.deepEqual(message.members, askeMessage.members);
                assert.deepEqual(message.intKeys, null);
                assert.deepEqual(message.nonces, askeMessage.nonces);
                assert.deepEqual(message.pubKeys, askeMessage.pubKeys);
                assert.strictEqual(message.sessionSignature, askeMessage.sessionSignature);
                assert.strictEqual(message.signingKey, null);
            });

            it('merge the messages for CLIQUES only', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var cliquesMessage = {source: '1', dest: '', agreement: 'aka', flow: 'downflow',
                                      members: ['1', '2', '3', '4', '5'], intKeys: null};
                var message = participant._mergeMessages(cliquesMessage, null);
                assert.strictEqual(message.source, '1');
                assert.strictEqual(message.dest, cliquesMessage.dest);
                assert.strictEqual(message.flow, cliquesMessage.flow);
                assert.strictEqual(message.agreement, 'auxilliary');
                assert.deepEqual(message.members, cliquesMessage.members);
                assert.deepEqual(message.intKeys, cliquesMessage.intKeys);
            });

            it('merge the messages for final case (no messages)', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = participant._mergeMessages(null, undefined);
                assert.strictEqual(message, null);
            });
        });

        describe('#_getCliquesMessage() method', function() {
            it('the vanilla ika case', function() {
                var message = {
                    source: '1',
                    dest: '2',
                    agreement: 'initial',
                    flow: 'upflow',
                    members: ['1', '2', '3', '4', '5', '6'],
                    intKeys: null,
                    nonces: null,
                    pubKeys: null,
                    sessionSignature: null
                };

                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var compare = {source: '1', dest: '2', agreement: 'ika', flow: 'upflow',
                               members: ['1', '2', '3', '4', '5', '6'], intKeys: null};
                var cliquesMessage = participant._getCliquesMessage(message);
                assert.strictEqual(cliquesMessage.source, compare.source);
                assert.strictEqual(cliquesMessage.dest, compare.dest);
                assert.strictEqual(cliquesMessage.flow, compare.flow);
                assert.strictEqual(cliquesMessage.agreement, compare.agreement);
                assert.deepEqual(cliquesMessage.members, compare.members);
                assert.deepEqual(cliquesMessage.intKeys, compare.intKeys);
            });
        });

        describe('#_getAskeMessage() method', function() {
            it('the vanilla initial case', function() {
                var message = {
                    source: '1',
                    dest: '2',
                    agreement: 'initial',
                    flow: 'upflow',
                    members: ['1', '2', '3', '4', '5', '6'],
                    intKeys: null,
                    nonces: null,
                    pubKeys: null,
                    sessionSignature: null,
                    signingKey: null,
                };

                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var compare = {source: '1', dest: '2', flow: 'upflow',
                               members: ['1', '2', '3', '4', '5', '6'],
                               nonces: null, pubKeys: null, sessionSignature: null,
                               signingKey: null};
                var askeMessage = participant._getAskeMessage(message);
                assert.strictEqual(askeMessage.source, compare.source);
                assert.strictEqual(askeMessage.dest, compare.dest);
                assert.strictEqual(askeMessage.flow, compare.flow);
                assert.deepEqual(askeMessage.members, compare.members);
                assert.deepEqual(askeMessage.nonces, compare.nonces);
                assert.deepEqual(askeMessage.pubKeys, compare.pubKeys);
                assert.deepEqual(askeMessage.sessionSignature, compare.sessionSignature);
                assert.strictEqual(askeMessage.signingKey, compare.signingKey);
            });

            it('auxilliary downflow case for a quit', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY, _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var compare = {source: '1', dest: '', flow: 'downflow',
                               signingKey: _td.ED25519_PRIV_KEY};
                var askeMessage = participant._getAskeMessage(_td.DOWNFLOW_MESSAGE_CONTENT);
                assert.strictEqual(askeMessage.source, compare.source);
                assert.strictEqual(askeMessage.dest, compare.dest);
                assert.strictEqual(askeMessage.flow, compare.flow);
                assert.strictEqual(askeMessage.signingKey, compare.signingKey);
            });
        });

        describe('#_start() method', function() {
            it('start/initiate a group session', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                sandbox.spy(participant.cliquesMember, 'ika');
                sandbox.spy(participant.askeMember, 'commit');
                sandbox.stub(participant, '_mergeMessages').returns(null);
                var otherMembers = ['2', '3', '4', '5', '6'];
                var message = participant._start(otherMembers);
                sinon_assert.calledOnce(participant.cliquesMember.ika);
                sinon_assert.calledOnce(participant.askeMember.commit);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(message, null);
            });
        });

        describe('#start() method', function() {
            it('start/initiate a group session', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: "I'm puttin' the band back together!",
                               dest: 'elwood@blues.org/ios1234'};
                sandbox.stub(codec, 'encodeMessage', _echo);
                sandbox.stub(participant, '_start').returns(message);
                participant.start(['elwood@blues.org/ios1234']);
                sinon_assert.calledOnce(codec.encodeMessage);
                sinon_assert.calledOnce(participant._start);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'jake@blues.org/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, 'elwood@blues.org/ios1234');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.state, ns.STATE.INIT_UPFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [ns.STATE.INIT_UPFLOW,
                                     ns.STATE.INIT_DOWNFLOW,
                                     ns.STATE.INITIALISED,
                                     ns.STATE.AUX_UPFLOW,
                                     ns.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.state = illegalStates[i];
                    assert.throws(function() { participant.start(); },
                                  'start() can only be called from an uninitialised state.');
                }
            });
        });

        describe('#_join() method', function() {
            it('join empty member list', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                assert.throws(function() { participant._join([]); },
                              'No members to add.');
            });

            it('add members to group', function() {
                var participant = new ns.ProtocolHandler('1',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.cliquesMember.akaJoin = sinon_spy();
                participant.askeMember.join = sinon_spy();
                participant._mergeMessages = stub().returns(null);
                var otherMembers = ['6', '7'];
                var message = participant._join(otherMembers);
                sinon_assert.calledOnce(participant.cliquesMember.akaJoin);
                sinon_assert.calledOnce(participant.askeMember.join);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(message, null);
            });
        });

        describe('#join() method', function() {
            it('add members to group', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INITIALISED;
                var message = {message: "I'm puttin' the band back together!",
                               dest: 'ray@charles.org/ios1234'};
                sandbox.stub(codec, 'encodeMessage', _echo);
                sandbox.stub(participant, '_join').returns(message);
                participant.join(['ray@charles.org/ios1234']);
                sinon_assert.calledOnce(codec.encodeMessage);
                sinon_assert.calledOnce(participant._join);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'jake@blues.org/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, 'ray@charles.org/ios1234');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.state, ns.STATE.AUX_UPFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [ns.STATE.NULL,
                                     ns.STATE.INIT_UPFLOW,
                                     ns.STATE.INIT_DOWNFLOW,
                                     ns.STATE.AUX_UPFLOW,
                                     ns.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.state = illegalStates[i];
                    assert.throws(function() { participant.join(); },
                                  'join() can only be called from an initialised state.');
                }
            });
        });

        describe('#_exclude() method', function() {
            it('exclude empty member list', function() {
                var participant = new ns.ProtocolHandler('3',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                assert.throws(function() { participant._exclude([]); },
                              'No members to exclude.');
            });

            it('exclude self', function() {
                var participant = new ns.ProtocolHandler('3',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                assert.throws(function() { participant._exclude(['3', '5']); },
                              'Cannot exclude mysefl.');
            });

            it('exclude members', function() {
                var participant = new ns.ProtocolHandler('3',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.cliquesMember.akaExclude = sinon_spy();
                participant.askeMember.exclude = sinon_spy();
                participant._mergeMessages = stub().returns(null);
                var message = participant._exclude(['1', '4']);
                sinon_assert.calledOnce(participant.cliquesMember.akaExclude);
                sinon_assert.calledOnce(participant.askeMember.exclude);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(message, null);
            });
        });

        describe('#exclude() method', function() {
            it('exclude members', function() {
                var participant = new ns.ProtocolHandler('a.dumbledore@hogwarts.ac.uk/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INITIALISED;
                var message = {message: "You're fired!",
                               dest: ''};
                sandbox.stub(codec, 'encodeMessage', _echo);
                sandbox.stub(participant, '_exclude').returns(message);
                participant.exclude(['g.lockhart@hogwarts.ac.uk/ios1234']);
                sinon_assert.calledOnce(codec.encodeMessage);
                sinon_assert.calledOnce(participant._exclude);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'a.dumbledore@hogwarts.ac.uk/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.state, ns.STATE.AUX_DOWNFLOW);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [ns.STATE.NULL,
                                     ns.STATE.INIT_UPFLOW,
                                     ns.STATE.INIT_DOWNFLOW,
                                     ns.STATE.AUX_UPFLOW,
                                     ns.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.state = illegalStates[i];
                    assert.throws(function() { participant.exclude(); },
                                  'exclude() can only be called from an initialised state.');
                }
            });
        });

        describe('#_quit() method', function() {
            it('not a member any more', function() {
                var participant = new ns.ProtocolHandler('3',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                assert.throws(function() { participant._quit(); },
                              'Not participating.');
            });

            it('simple test', function() {
                var participant = new ns.ProtocolHandler('Peter',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                sandbox.spy(participant.askeMember, 'quit');
                sandbox.stub(participant.cliquesMember, 'akaQuit');
                sandbox.stub(participant, '_mergeMessages').returns(null);
                var message = participant._quit();
                sinon_assert.calledOnce(participant.askeMember.quit);
                sinon_assert.calledOnce(participant.cliquesMember.akaQuit);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(message, null);
            });
        });

        describe('#quit() method', function() {
            it('simple test', function() {
                var participant = new ns.ProtocolHandler('Peter@genesis.co.uk/android4711',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state =  ns.STATE.INITIALISED;
                var message = {signingKey: 'Sledge Hammer',
                               source: 'Peter@genesis.co.uk/android4711',
                               dest: ''};
                sandbox.stub(codec, 'encodeMessage', _echo);
                participant._quit = stub().returns(message);
                participant.quit();
                sinon_assert.calledOnce(codec.encodeMessage);
                sinon_assert.calledOnce(participant._quit);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'Peter@genesis.co.uk/android4711');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.state, ns.STATE.NULL);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [ns.STATE.NULL,
                                     ns.STATE.INIT_UPFLOW,
                                     ns.STATE.INIT_DOWNFLOW,
                                     ns.STATE.AUX_UPFLOW,
                                     ns.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.state = illegalStates[i];
                    assert.throws(function() { participant.quit(); },
                                  'quit() can only be called from an initialised state.');
                }
            });
        });

        describe('#_refresh() method', function() {
            it('refresh own private key using aka', function() {
                var participant = new ns.ProtocolHandler('3',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant._mergeMessages = stub().returns(null);
                participant.cliquesMember.akaRefresh = sinon_spy();
                var message = participant._refresh();
                sinon_assert.calledOnce(participant.cliquesMember.akaRefresh);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(message, null);
            });
        });

        describe('#refresh() method', function() {
            it('refresh own private key using aka', function() {
                var participant = new ns.ProtocolHandler('dj.jazzy.jeff@wraper.com/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state =  ns.STATE.INITIALISED;
                var message = {message: "Fresh Prince",
                               dest: ''};
                sandbox.stub(codec, 'encodeMessage', _echo);
                participant._refresh = stub().returns(message);
                participant.refresh();
                sinon_assert.calledOnce(codec.encodeMessage);
                sinon_assert.calledOnce(participant._refresh);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.deepEqual(participant.protocolOutQueue[0].message, message);
                assert.strictEqual(participant.protocolOutQueue[0].from, 'dj.jazzy.jeff@wraper.com/android123');
                assert.strictEqual(participant.protocolOutQueue[0].to, '');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
                assert.strictEqual(participant.state, ns.STATE.INITIALISED);
            });

            it('illegal state transition', function() {
                var participant = new ns.ProtocolHandler('jake@blues.org/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var illegalStates = [ns.STATE.NULL,
                                     ns.STATE.INIT_UPFLOW,
                                     ns.STATE.INIT_DOWNFLOW,
                                     ns.STATE.AUX_UPFLOW,
                                     ns.STATE.AUX_DOWNFLOW];
                for (var i = 0; i < illegalStates.length; i++) {
                    participant.state = illegalStates[i];
                    assert.throws(function() { participant.refresh(); },
                                  'refresh() can only be called from an initialised state.');
                }
            });
        });

        describe('#_processKeyingMessage() method', function() {
            it('processing for an upflow message', function() {
                var message = { source: '1', dest: '2', agreement: 'initial',
                                flow: 'upflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [null, []], debugKeys: [null, '1*G'],
                                nonces: ['foo'], pubKeys: ['foo'],
                                sessionSignature: null };
                var compare = { source: '2', dest: '3', agreement: 'initial',
                                flow: 'upflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [[], [], []], debugKeys: ['2*G', '1*G', '2*1*G'],
                                nonces: ['foo', 'bar'], pubKeys: ['foo', 'bar'],
                                sessionSignature: null };
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                sandbox.stub(codec, 'decodeMessageContent', _echo);
                sandbox.stub(codec, 'encodeMessage', _echo);
                var output = participant._processKeyingMessage(message);
                assert.strictEqual(output.source, compare.source);
                assert.strictEqual(output.dest, compare.dest);
                assert.strictEqual(output.agreement, compare.agreement);
                assert.strictEqual(output.flow, compare.flow);
                assert.deepEqual(output.members, compare.members);
                assert.lengthOf(output.intKeys, compare.intKeys.length);
                assert.deepEqual(output.debugKeys, compare.debugKeys);
                assert.lengthOf(output.nonces, compare.nonces.length);
                assert.lengthOf(output.pubKeys, compare.pubKeys.length);
                assert.strictEqual(output.sessionSignature, compare.sessionSignature);
                assert.strictEqual(participant.state, ns.STATE.INIT_UPFLOW);
            });

            it('processing for last upflow message', function() {
                var message = { source: '4', dest: '5', agreement: 'initial',
                                flow: 'upflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [[], [], [], [], []],
                                debugKeys: ['', '', '', '', ''],
                                nonces: ['foo1', 'foo2', 'foo3', 'foo4'],
                                pubKeys: ['foo1', 'foo2', 'foo3', 'foo4'],
                                sessionSignature: null };
                var compare = { source: '5', dest: '', agreement: 'initial',
                                flow: 'downflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [[], [], [], [], []],
                                nonces: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                pubKeys: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                sessionSignature: 'bar' };
                var participant = new ns.ProtocolHandler('5',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.NULL;
                sandbox.stub(codec, 'decodeMessageContent', _echo);
                sandbox.stub(codec, 'encodeMessage', _echo);
                var output = participant._processKeyingMessage(message);
                assert.strictEqual(output.source, compare.source);
                assert.strictEqual(output.dest, compare.dest);
                assert.strictEqual(output.agreement, compare.agreement);
                assert.strictEqual(output.flow, compare.flow);
                assert.deepEqual(output.members, compare.members);
                assert.lengthOf(output.intKeys, compare.intKeys.length);
                assert.lengthOf(output.nonces, compare.nonces.length);
                assert.lengthOf(output.pubKeys, compare.pubKeys.length);
                assert.ok(output.sessionSignature);
                assert.strictEqual(participant.state, ns.STATE.INIT_DOWNFLOW);
            });

            it('processing for a downflow message', function() {
                var message = { source: '5', dest: '', agreement: 'initial',
                                flow: 'downflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [[], [], [], [], []],
                                debugKeys: ['5*4*3*2*G', '5*4*3*1*G', '5*4*2*1*G',
                                            '5*3*2*1*G', '4*3*2*1*G'],
                                nonces: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                pubKeys: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                sessionSignature: 'bar' };
                var participant = new ns.ProtocolHandler('2',
                                                       _td.RSA_PRIV_KEY,
                                                       _td.RSA_PUB_KEY,
                                                       _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INIT_UPFLOW;
                sandbox.spy(participant.cliquesMember, 'upflow');
                sandbox.stub(participant.cliquesMember, 'downflow');
                sandbox.spy(participant.askeMember, 'upflow');
                sandbox.stub(participant.askeMember, 'downflow');
                sandbox.stub(participant, '_mergeMessages').returns({dest: ''});
                sandbox.stub(codec, 'decodeMessageContent', _echo);
                sandbox.stub(codec, 'encodeMessage', _echo);
                participant._processKeyingMessage(message);
                assert.strictEqual(participant.cliquesMember.upflow.callCount, 0);
                assert.strictEqual(participant.askeMember.upflow.callCount, 0);
                sinon_assert.calledOnce(participant.cliquesMember.downflow);
                sinon_assert.calledOnce(participant.askeMember.downflow);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(participant.state, ns.STATE.INIT_DOWNFLOW);
            });

            it('processing for a downflow message after CLIQUES finish', function() {
                var message = { source: '5', dest: '', agreement: 'initial',
                                flow: 'downflow', members: ['1', '2', '3', '4', '5'],
                                intKeys: [], debugKeys: [],
                                nonces: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                pubKeys: ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
                                sessionSignature: 'bar' };
                var participant = new ns.ProtocolHandler('2',
                                                       _td.RSA_PRIV_KEY,
                                                       _td.RSA_PUB_KEY,
                                                       _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INIT_DOWNFLOW;
                sandbox.spy(participant.cliquesMember, 'upflow');
                sandbox.spy(participant.cliquesMember, 'downflow');
                sandbox.spy(participant.askeMember, 'upflow');
                sandbox.stub(participant.askeMember, 'downflow');
                sandbox.spy(participant, '_mergeMessages');
                sandbox.stub(codec, 'decodeMessageContent', _echo);
                sandbox.stub(codec, 'encodeMessage', _echo);
                sandbox.stub(participant.askeMember, 'isSessionAcknowledged').returns(true);
                participant._processKeyingMessage(message);
                assert.strictEqual(participant.cliquesMember.upflow.callCount, 0);
                assert.strictEqual(participant.askeMember.upflow.callCount, 0);
                assert.strictEqual(participant.cliquesMember.downflow.callCount, 0);
                sinon_assert.calledOnce(participant.askeMember.downflow);
                sinon_assert.calledOnce(participant.askeMember.isSessionAcknowledged);
                sinon_assert.calledOnce(participant._mergeMessages);
                assert.strictEqual(participant.state, ns.STATE.INITIALISED);
            });

            it('processing for a downflow quit message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                       _td.RSA_PRIV_KEY,
                                                       _td.RSA_PUB_KEY,
                                                       _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INITIALISED;
                sandbox.stub(codec, 'decodeMessageContent', _echo);
                sandbox.stub(codec, 'encodeMessage', _echo);
                assert.throws(function() { participant._processKeyingMessage(_td.DOWNFLOW_MESSAGE_CONTENT); },
                              'Key refresh for quitting is not implemented, yet!');
            });
        });

        describe('#send() method', function() {
            it('send a message confidentially', function() {
                var participant = new ns.ProtocolHandler('orzabal@tearsforfears.co.uk/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.cliquesMember.groupKey = _td.COMP_KEY;
                participant.askeMember.ephemeralPrivKey = _td.ED25519_PRIV_KEY;
                participant.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                participant.state = ns.STATE.INITIALISED;
                var message = 'Shout, shout, let it all out!';
                participant.send(message);
                assert.lengthOf(participant.messageOutQueue, 1);
                assert.lengthOf(participant.messageOutQueue[0].message, 180);
                assert.strictEqual(participant.messageOutQueue[0].from, 'orzabal@tearsforfears.co.uk/android123');
                assert.strictEqual(participant.messageOutQueue[0].to, '');
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
            });

            it('on uninitialised state', function() {
                var participant = new ns.ProtocolHandler('kenny@southpark.com/android123',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INIT_DOWNFLOW;
                assert.throws(function() { participant.send('Wassup?'); },
                              'Messages can only be sent in initialised state.');
            });
        });

        describe('#processMessage() method', function() {
            it('on plain text message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: 'Pōkarekare ana ngā wai o Waitemata, whiti atu koe hine marino ana e.',
                               from: 'kiri@singer.org.nz/waiata42'};
                participant.processMessage(message);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].message.substring(0, 9),
                                   '?mpENCv' + version.PROTOCOL_VERSION.charCodeAt(0) + '?');
                assert.strictEqual(participant.protocolOutQueue[0].from,
                                   '2');
                assert.strictEqual(participant.protocolOutQueue[0].to,
                                   'kiri@singer.org.nz/waiata42');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'info');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'Received unencrypted message, requesting encryption.');
            });

            it('on error message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: '?mpENC Error:Hatschi!',
                               from: 'common@cold.govt.nz/flu2'};
                participant.processMessage(message);
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'error');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'Error in mpEnc protocol: Hatschi!');
            });

            it('on keying message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var groupKey = _td.COMP_KEY.substring(0, 16);
                participant.cliquesMember.groupKey = groupKey;
                participant.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                var message = {message: '?mpENC:Zm9v.',
                               from: 'bar@baz.nl/blah123'};
                sandbox.stub(codec, 'decodeMessageContent').returns('foo');
                participant._processKeyingMessage = stub().returns('foo');
                sandbox.stub(codec, 'encodeMessage', _echo);
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeMessageContent);
                sinon_assert.calledOnce(participant._processKeyingMessage);
                sinon_assert.calledOnce(codec.encodeMessage);
                assert.lengthOf(participant.protocolOutQueue, 1);
                assert.strictEqual(participant.protocolOutQueue[0].message, 'foo');
                assert.strictEqual(participant.protocolOutQueue[0].from, '2');
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 0);
            });

            it('on data message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.STATE.INITIALISED;
                var groupKey = _td.COMP_KEY.substring(0, 16);
                participant.cliquesMember.groupKey = groupKey;
                participant.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                var message = {message: _td.DATA_MESSAGE_PAYLOAD,
                               from: 'bar@baz.nl/blah123'};
                sandbox.stub(codec, 'decodeMessageContent').returns(_td.DATA_MESSAGE_CONTENT);
                sandbox.stub(participant.askeMember, 'getMemberEphemeralPubKey').returns('lala');
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeMessageContent);
                assert.lengthOf(codec.decodeMessageContent.getCall(0).args, 3);
                assert.strictEqual(codec.decodeMessageContent.getCall(0).args[1],
                                   groupKey);
                assert.strictEqual(codec.decodeMessageContent.getCall(0).args[2],
                                   'lala');
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'message');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'foo');
            });

            it('on data message, invalid signature', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                participant.state = ns.INITIALISED;
                var groupKey = _td.COMP_KEY.substring(0, 16);
                participant.cliquesMember.groupKey = groupKey;
                participant.askeMember.ephemeralPubKey = _td.ED25519_PUB_KEY;
                var decodedContent = utils.clone(_td.DATA_MESSAGE_CONTENT);
                decodedContent.signatureOk = false;
                var message = {message: _td.DATA_MESSAGE_PAYLOAD,
                               from: 'bar@baz.nl/blah123'};
                sandbox.stub(codec, 'decodeMessageContent').returns(decodedContent);
                participant.processMessage(message);
                sinon_assert.calledOnce(codec.decodeMessageContent);
                assert.lengthOf(participant.protocolOutQueue, 0);
                assert.lengthOf(participant.messageOutQueue, 0);
                assert.lengthOf(participant.uiQueue, 1);
                assert.strictEqual(participant.uiQueue[0].type, 'error');
                assert.strictEqual(participant.uiQueue[0].message,
                                   'Signature of received message invalid.');
            });

            it('on query message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: '?mpENCv' + version.PROTOCOL_VERSION.charCodeAt(0) + '?foo.',
                               from: 'raw@hide.com/rollingrollingrolling'};
                participant.start = stub();
                participant.processMessage(message);
                sinon_assert.calledOnce(participant.start);
            });

            it('on quit message', function() {
                var participant = new ns.ProtocolHandler('2',
                                                         _td.RSA_PRIV_KEY,
                                                         _td.RSA_PUB_KEY,
                                                         _td.STATIC_PUB_KEY_DIR);
                var message = {message: '?mpENCv' + version.PROTOCOL_VERSION.charCodeAt(0) + '?foo.',
                               from: 'raw@hide.com/rollingrollingrolling'};
                participant.start = stub();
                participant.processMessage(message);
                sinon_assert.calledOnce(participant.start);
            });

            it('whole flow for 5 members, 2 joining, 2 others leaving, send message, refresh key', function() {
                var numMembers = 5;
                var initiator = 0;
                var members = [];
                var participants = [];
                for (var i = 1; i <= numMembers; i++) {
                    members.push(i.toString());
                    var newMember = new ns.ProtocolHandler(i.toString(),
                                                           _td.RSA_PRIV_KEY,
                                                           _td.RSA_PUB_KEY,
                                                           _td.STATIC_PUB_KEY_DIR);
                    participants.push(newMember);
                }
                var otherMembers = [];
                for (var i = 2; i <= numMembers; i++) {
                    otherMembers.push(i.toString());
                }

                // Start.
                participants[initiator].start(otherMembers);
                var message = participants[initiator].protocolOutQueue.shift();
                var payload = _getPayload(message);
                assert.strictEqual(participants[initiator].state, ns.STATE.INIT_UPFLOW);

                // Upflow.
                while (message && payload.dest !== '') {
                    var nextId = payload.members.indexOf(payload.dest);
                    participants[nextId].processMessage(message);
                    message = participants[nextId].protocolOutQueue.shift();
                    payload = _getPayload(message);
                    if (payload.dest === '') {
                        assert.strictEqual(participants[nextId].state, ns.STATE.INIT_DOWNFLOW);
                    } else {
                        assert.strictEqual(participants[nextId].state, ns.STATE.INIT_UPFLOW);
                    }
                }

                // Downflow.
                var nextMessages = [];
                while (payload) {
                    for (var i = 0; i < participants.length; i++) {
                        var participant = participants[i];
                        if (members.indexOf(participant.id) < 0) {
                            continue;
                        }
                        participant.processMessage(message);
                        var nextMessage =  participant.protocolOutQueue.shift();
                        if (nextMessage) {
                            nextMessages.push(utils.clone(nextMessage));
                        }
                        if (participant.askeMember.isSessionAcknowledged()) {
                            assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                        } else {
                            assert.strictEqual(participant.state, ns.STATE.INIT_DOWNFLOW);
                        }
                        assert.deepEqual(participant.cliquesMember.members, members);
                        assert.deepEqual(participant.askeMember.members, members);
                    }
                    message = nextMessages.shift();
                    payload = _getPayload(message);
                }
                var keyCheck = null;
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    if (!keyCheck) {
                        keyCheck = participant.cliquesMember.groupKey;
                    } else {
                        assert.strictEqual(participant.cliquesMember.groupKey, keyCheck);
                    }
                    assert.ok(participant.askeMember.isSessionAcknowledged());
                    assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                    assert.lengthOf(participant.protocolOutQueue, 0);
                    assert.lengthOf(participant.uiQueue, 0);
                    assert.lengthOf(participant.messageOutQueue, 0);
                }

                // Join two new guys.
                var newMembers = ['6', '7'];
                members = members.concat(newMembers);
                for (var i = 0; i < newMembers.length; i++) {
                    var newMember = new ns.ProtocolHandler(newMembers[i],
                                                           _td.RSA_PRIV_KEY,
                                                           _td.RSA_PUB_KEY,
                                                           _td.STATIC_PUB_KEY_DIR);
                    participants.push(newMember);
                }

                // '4' starts upflow for join.
                participants[3].join(newMembers);
                message = participants[3].protocolOutQueue.shift();
                payload = _getPayload(message);

                // Upflow for join.
                while (payload.dest !== '') {
                    var nextId = payload.members.indexOf(payload.dest);
                    participants[nextId].processMessage(message);
                    message = participants[nextId].protocolOutQueue.shift();
                    payload = _getPayload(message);
                    if (payload.dest === '') {
                        assert.strictEqual(participants[nextId].state, ns.STATE.AUX_DOWNFLOW);
                    } else {
                        assert.strictEqual(participants[nextId].state, ns.STATE.AUX_UPFLOW);
                    }
                }

                // Downflow for join.
                nextMessages = [];
                while (payload) {
                    for (var i = 0; i < participants.length; i++) {
                        var participant = participants[i];
                        if (members.indexOf(participant.id) < 0) {
                            continue;
                        }
                        participant.processMessage(message);
                        var nextMessage = participant.protocolOutQueue.shift();
                        if (nextMessage) {
                            nextMessages.push(utils.clone(nextMessage));
                        }
//                        if (participant.askeMember.isSessionAcknowledged()) {
//                            assert.strictEqual(participant.state, ns.STATE.INITIALISED);
//                        } else {
//                            assert.strictEqual(participant.state, ns.STATE.AUX_DOWNFLOW);
//                        }
                        assert.deepEqual(participant.cliquesMember.members, members);
                        assert.deepEqual(participant.askeMember.members, members);
                    }
                    message = nextMessages.shift();
                    payload = _getPayload(message);
                }
                keyCheck = null;
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    if (!keyCheck) {
                        keyCheck = participant.cliquesMember.groupKey;
                    } else {
                        assert.strictEqual(participant.cliquesMember.groupKey, keyCheck);
                    }
                    assert.ok(participant.askeMember.isSessionAcknowledged());
                    assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                    assert.lengthOf(participant.protocolOutQueue, 0);
                    assert.lengthOf(participant.uiQueue, 0);
                    assert.lengthOf(participant.messageOutQueue, 0);
                }

                // '3' excludes two members.
                var toExclude = ['1', '4'];
                members.splice(members.indexOf('1'), 1);
                members.splice(members.indexOf('4'), 1);
                participants[2].exclude(toExclude);
                message = participants[2].protocolOutQueue.shift();
                payload = _getPayload(message);

                // Downflow for exclude.
                nextMessages = [];
                while (payload) {
                    for (var i = 0; i < participants.length; i++) {
                        var participant = participants[i];
                        if (members.indexOf(participant.id) < 0) {
                            continue;
                        }
                        participant.processMessage(message);
                        var nextMessage = participant.protocolOutQueue.shift();
                        if (nextMessage) {
                            nextMessages.push(utils.clone(nextMessage));
                        }
                        if (participant.askeMember.isSessionAcknowledged()) {
                            assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                        } else {
                            assert.strictEqual(participant.state, ns.STATE.AUX_DOWNFLOW);
                        }
                        assert.deepEqual(participant.cliquesMember.members, members);
                        assert.deepEqual(participant.askeMember.members, members);
                    }
                    message = nextMessages.shift();
                    payload = _getPayload(message);
                }
                keyCheck = null;
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    if (!keyCheck) {
                        keyCheck = participant.cliquesMember.groupKey;
                    } else {
                        assert.strictEqual(participant.cliquesMember.groupKey, keyCheck);
                    }
                    assert.ok(participant.askeMember.isSessionAcknowledged());
                    assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                    assert.lengthOf(participant.protocolOutQueue, 0);
                    assert.lengthOf(participant.uiQueue, 0);
                    assert.lengthOf(participant.messageOutQueue, 0);
                }

                // '5' sends a confidential text message to the group.
                participants[4].send('Rock me Amadeus');
                message = participants[4].messageOutQueue.shift();

                // Received message for all.
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    var messageClone = utils.clone(message);
                    participant.processMessage(messageClone);
                    var uiMessage = participant.uiQueue.shift();
                    assert.strictEqual(uiMessage.message, 'Rock me Amadeus');
                    assert.strictEqual(uiMessage.type, 'message');
                    assert.strictEqual(uiMessage.from, '5');
                }

                // '2' initiates a key refresh.
                var oldGroupKey = participants[1].cliquesMember.groupKey;
                var oldPrivKey = participants[1].cliquesMember.privKey;
                participants[1].refresh();
                message = participants[1].protocolOutQueue.shift();
                payload = _getPayload(message);
                assert.notStrictEqual(participants[1].cliquesMember.privKey, oldPrivKey);
                assert.notStrictEqual(participants[1].cliquesMember.groupKey, oldGroupKey);

                // Downflow for refresh.
                nextMessages = [];
                while (payload) {
                    for (var i = 0; i < participants.length; i++) {
                        var participant = participants[i];
                        if (members.indexOf(participant.id) < 0) {
                            continue;
                        }
                        oldPrivKey = participant.cliquesMember.privKey;
                        participant.processMessage(message);
                        var nextMessage = participant.protocolOutQueue.shift();
                        if (nextMessage) {
                            nextMessages.push(utils.clone(nextMessage));
                        }
                        if (participant.askeMember.isSessionAcknowledged()) {
                            assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                        } else {
                            assert.strictEqual(participant.state, ns.STATE.AUX_DOWNFLOW);
                        }
                        assert.deepEqual(participant.cliquesMember.members, members);
                        assert.deepEqual(participant.askeMember.members, members);
                    }
                    message = nextMessages.shift();
                    payload = _getPayload(message);
                }
                keyCheck = null;
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    if (!keyCheck) {
                        keyCheck = participant.cliquesMember.groupKey;
                    } else {
                        assert.strictEqual(participant.cliquesMember.groupKey, keyCheck);
                    }
                    assert.notStrictEqual(participant.cliquesMember.groupKey, oldGroupKey);
                    assert.ok(participant.askeMember.isSessionAcknowledged());
                    assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                    assert.lengthOf(participant.protocolOutQueue, 0);
                    assert.lengthOf(participant.uiQueue, 0);
                    assert.lengthOf(participant.messageOutQueue, 0);
                }
            });

            it('whole flow for two initiated by plain text message', function() {
                var numMembers = 2;
                var members = [];
                var participants = [];
                for (var i = 1; i <= numMembers; i++) {
                    members.push(i.toString());
                    var newMember = new ns.ProtocolHandler(i.toString(),
                                                           _td.RSA_PRIV_KEY,
                                                           _td.RSA_PUB_KEY,
                                                           _td.STATIC_PUB_KEY_DIR);
                    participants.push(newMember);
                }
                var message = {message: 'Kia ora', from: '1', to: '2'};
                var payload = null;

                // Processing plain text message.
                participants[1].processMessage(message);
                message = participants[1].protocolOutQueue.shift();
                assert.strictEqual(message.message.substring(0, 9),
                                   '?mpENCv' + version.PROTOCOL_VERSION.charCodeAt(0) + '?');
                assert.strictEqual(message.from, '2');
                assert.strictEqual(message.to, '1');
                var uiMessage = participants[1].uiQueue.shift();
                assert.strictEqual(uiMessage.type, 'info');
                assert.strictEqual(uiMessage.message, 'Received unencrypted message, requesting encryption.');
                assert.strictEqual(participants[1].state, ns.STATE.NULL);

                // Process mpEnc query response.
                participants[0].processMessage(message);
                message = participants[0].protocolOutQueue.shift();
                payload = _getPayload(message);
                assert.strictEqual(payload.source, '1');
                assert.strictEqual(payload.dest, '2');
                assert.strictEqual(payload.agreement, 'initial');
                assert.strictEqual(payload.flow, 'upflow');
                assert.strictEqual(participants[0].state, ns.STATE.INIT_UPFLOW);

                // Process key agreement upflow.
                participants[1].processMessage(message);
                message = participants[1].protocolOutQueue.shift();
                payload = _getPayload(message);
                assert.strictEqual(payload.source, '2');
                assert.strictEqual(payload.dest, '');
                assert.strictEqual(payload.agreement, 'initial');
                assert.strictEqual(payload.flow, 'downflow');
                assert.strictEqual(participants[1].state, ns.STATE.INIT_DOWNFLOW);

                // Downflow for both.
                var nextMessages = [];
                while (payload) {
                    for (var i = 0; i < participants.length; i++) {
                        var participant = participants[i];
                        if (members.indexOf(participant.id) < 0) {
                            continue;
                        }
                        participant.processMessage(message);
                        var nextMessage = participant.protocolOutQueue.shift();
                        if (nextMessage) {
                            nextMessages.push(utils.clone(nextMessage));
                        }
                        if (participant.askeMember.isSessionAcknowledged()) {
                            assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                        } else {
                            assert.strictEqual(participant.state, ns.STATE.INIT_DOWNFLOW);
                        }
                        assert.deepEqual(participant.cliquesMember.members, members);
                        assert.deepEqual(participant.askeMember.members, members);
                    }
                    message = nextMessages.shift();
                    payload = _getPayload(message);
                }
                var keyCheck = null;
                for (var i = 0; i < participants.length; i++) {
                    var participant = participants[i];
                    if (members.indexOf(participant.id) < 0) {
                        continue;
                    }
                    if (!keyCheck) {
                        keyCheck = participant.cliquesMember.groupKey;
                    } else {
                        assert.strictEqual(participant.cliquesMember.groupKey, keyCheck);
                    }
                    assert.ok(participant.askeMember.isSessionAcknowledged());
                    assert.strictEqual(participant.state, ns.STATE.INITIALISED);
                    assert.lengthOf(participant.protocolOutQueue, 0);
                    assert.lengthOf(participant.uiQueue, 0);
                    assert.lengthOf(participant.messageOutQueue, 0);
                }
            });
        });
    });
});