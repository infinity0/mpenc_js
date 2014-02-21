/**
 * @fileOverview
 * Implementation of an authenticated Signature Key Exchange scheme.
 */

"use strict";

/**
 * @namespace
 * Implementation of an authenticated Signature Key Exchange scheme.
 * 
 * @description
 * <p>Implementation of an authenticated Signature Key Exchange scheme.</p>
 * 
 * <p>
 * This scheme is trying to prevent replay attacks by the use of a nonce-based
 * session ID as described in </p>
 * 
 * <p>
 * Jens-Matthias Bohli and Rainer Steinwandt. 2006.<br/>
 * "Deniable Group Key Agreement."<br/>
 * VIETCRYPT 2006, LNCS 4341, pp. 298-311.</p>
 * 
 * <p>
 * This implementation is using the Edwards25519 for an ECDSA signature
 * mechanism to complement the Curve25519-based group key agreement.</p>
 */
mpenc.ske = {};

/*
 * Created: 5 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
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

/**
 * Carries message content for the authenticated signature key exchange.
 * 
 * @constructor
 * @param source
 *     Message originator (from).
 * @param dest
 *     Message destination (to).
 * @param flow
 *     Message type.
 * @param members
 *     List (array) of all participating members.
 * @param nonces
 *     List (array) of all participants' nonces.
 * @param pubKeys
 *     List (array) of all participants' ephemeral public keys.
 * @param sessionSignature
 *     Signature to acknowledge the session.
 * @returns {SignatureKeyExchangeMessage}
 */
mpenc.ske.SignatureKeyExchangeMessage = function(source, dest, flow, members,
                                                 nonces, pubKeys,
                                                 sessionSignature) {
    this.source = source || '';
    this.dest = dest || '';
    this.flow = flow || '';
    this.members = members || [];
    this.nonces = nonces || [];
    this.pubKeys = pubKeys || [];
    this.sessionSignature = sessionSignature || null;
    
    return this;
};


/**
 * Implementation of the authenticated signature key exchange.
 * 
 * This implementation is using Edwards25519 ECDSA signatures.
 * 
 * @constructor
 * @param id {string}
 *     Member's identifier string.
 * @returns {SignatureKeyExchangeMember}
 * 
 * @property id {string}
 *     Member's identifier string.
 * @property members
 *     List of all participants.
 */
mpenc.ske.SignatureKeyExchangeMember = function(id) {
    this.id = id;
    this.members = [];
    this.ephemeralPrivKey = null;
    this.ephemeralPubKey = null;
    this.nonce = null;
    this.nonces = null;
    this.ephemeralPubKeys = null;
    this.sessionId = null;
    this.staticPrivKey = null;
    return this;
};


/**
 * Start the upflow for the the commit (nonce values and ephemeral public keys).
 * 
 * @param otherMembers
 *     Iterable of other members for the group (excluding self).
 * @returns {SignatureKeyExchangeMessage}
 * @method
 */
mpenc.ske.SignatureKeyExchangeMember.prototype.commit = function(otherMembers) {
    assert(otherMembers.length !== 0, 'No members to add.');
    this.ephemeralPubKeys = null;
    var startMessage = new mpenc.ske.SignatureKeyExchangeMessage(this.id,
                                                                 '', 'upflow');
    startMessage.members = [this.id].concat(otherMembers);
    this.nonce = null;
    this.nonces = [];
    this.ephemeralPubKeys = [];
    return this.upflow(startMessage);
};


/**
 * SKE upflow phase message processing.
 * 
 * @param message
 *     Received upflow message. See {@link SignatureKeyExchangeMessage}.
 * @returns {CSignatureKeyExchangeMessage}
 * @method
 */
mpenc.ske.SignatureKeyExchangeMember.prototype.upflow = function(message) {
    assert(mpenc.utils._noDuplicatesInList(message.members),
           'Duplicates in member list detected!');
    var myPos = message.members.indexOf(this.id);
    assert(myPos >= 0, 'Not member of this key exchange!');

    this.members = message.members;
    this.nonces = message.nonces;
    this.ephemeralPubKeys = message.pubKeys;
    
    // Make new nonce and ephemeral signing key pair.
    this.nonce = mpenc.utils._newKey08(256);
    this.nonces.push(this.nonce);
    this.ephemeralPrivKey = mpenc.utils._newKey08(512);
    this.ephemeralPubKey = djbec.publickey(this.ephemeralPrivKey);
    this.ephemeralPubKeys.push(this.ephemeralPubKey);
    
    // Pass on a message.
    if (myPos === this.members.length - 1) {
        // Compute my session ID.
        this.sessionId = mpenc.ske._computeSid(this.members, this.nonces);
        // I'm the last in the chain:
        // Broadcast all intermediate keys.
        message.source = this.id;
        message.dest = '';
        message.flow = 'downflow';
        message.sessionSignature = this._computeSessionSig();
    } else {
        // Pass a message on to the next in line.
        message.source = this.id;
        message.dest = this.members[myPos + 1];
    }
    message.nonces = this.nonces;
    message.pubKeys = this.ephemeralPubKeys;
    return message;
};


/**
 * Computes a session acknowledgement signature sigma(m) of a message
 * m = (pid_i, E_i, sid) using the static private key.
 * 
 * @returns
 *     Session signature.
 * @method
 */
mpenc.ske.SignatureKeyExchangeMember.prototype._computeSessionSig = function() {
    assert(this.sessionId, 'Session ID not available.');
    assert(this.ephemeralPubKey, 'No ephemeral key pair available.');
    var sidString = djbec._bytes2string(this.sessionId);
    var ePubKeyString = djbec._bytes2string(this.ephemeralPubKey);
    return mpenc.ske.smallrsasign(this.id + ePubKeyString + sidString,
                                  this.staticPrivKey);
};


/**
 * Converts a (binary) string to a multi-precision integer (MPI).
 * 
 * @param binstring
 *     Binary string representation of data.
 * @returns
 *     MPI representation.
 */
mpenc.ske._binstring2mpi = function(binstring) {
    var contentLength = binstring.length * 8;
    var data = String.fromCharCode(contentLength >> 8)
             + String.fromCharCode(contentLength & 255) + binstring;
    return mpi2b(data);
};


/**
 * Converts a multi-precision integer (MPI) to a (binary) string.
 * 
 * @param mpi
 *     MPI representation.
 * @returns
 *     Binary string representation of data.
 */
mpenc.ske._mpi2binstring = function(mpi) {
    return b2mpi(mpi).slice(2);
};

/**
 * Encodes the message according to the EME-PKCS1-V1_5 encoding scheme in
 * RFC 2437, section 9.1.2.
 * 
 * see: http://tools.ietf.org/html/rfc2437#section-9.1.2
 * 
 * @param message
 *     Message to encode.
 * @param length
 *     Destination length of the encoded message in bytes.
 * @returns
 *     Encoded message as binary string.
 */
mpenc.ske._pkcs1v15_encode = function(message, length) {
    _assert(message.length < length - 10,
            'message too long for encoding scheme');
    
    // Padding string.
    // TODO: Replace this with cryptographically secure random numbers.
    var padding = '';
    for (var i = 0; i < length - message.length - 2; i++) {
        padding += String.fromCharCode(1 + Math.floor(255 * Math.random()));
    }
    
    return String.fromCharCode(2) + padding + String.fromCharCode(0) + message;
};


/**
 * Decodes the message according to the EME-PKCS1-V1_5 encoding scheme in
 * RFC 2437, section 9.1.2.
 * 
 * see: http://tools.ietf.org/html/rfc2437#section-9.1.2
 * 
 * @param message
 *     Message to decode.
 * @returns
 *     Decoded message as binary string.
 */
mpenc.ske._pkcs1v15_decode = function(message) {
    _assert(message.length > 10, 'message decoding error');
    return message.slice(message.indexOf(String.fromCharCode(0)) + 1);
};


/**
 * Encrypts a binary string using an RSA public key. The data to be encrypted
 * must be encryptable <em>directly</em> using the key.
 * 
 * For secure random padding, the max. size of message = key size in bytes - 10.
 * 
 * @param cleartext
 *     Cleartext to encrypt.
 * @param pubkey
 *     Public RSA key.
 * @returns
 *     Ciphertext encoded as binary string.
 */
mpenc.ske.smallrsaencrypt = function(cleartext, pubkey) {
    // pubkey[2] is length of key in bits.
    var keyLength = pubkey[2] >> 3;
    
    // Convert to MPI format and return cipher as binary string.
    var data = mpenc.ske._binstring2mpi(mpenc.ske._pkcs1v15_encode(cleartext,
                                                                   keyLength));
    return mpenc.ske._mpi2binstring(RSAencrypt(data, pubkey[1], pubkey[0]));
};


/**
 * Decrypts a binary string using an RSA private key. The data to be decrypted
 * must be decryptable <em>directly</em> using the key.
 * 
 * @param ciphertext
 *     Ciphertext to decrypt.
 * @param privkey
 *     Private RSA key.
 * @returns
 *     Cleartext encoded as binary string.
 */
mpenc.ske.smallrsadecrypt = function(ciphertext, privkey) {
    var cleartext = RSAdecrypt(mpenc.ske._binstring2mpi(ciphertext),
                               privkey[2], privkey[0], privkey[1], privkey[3]);
    var data = mpenc.ske._mpi2binstring(cleartext);
    return mpenc.ske._pkcs1v15_decode(data);
};


/**
 * Encrypts a binary string using an RSA private key for the purpose of signing
 * (authenticating). The data to be encrypted must be decryptable
 * <em>directly</em> using the key.
 * 
 * For secure random padding, the max. size of message = key size in bytes - 10.
 * 
 * @param cleartext
 *     Message to encrypt.
 * @param privkey
 *     Private RSA key.
 * @returns
 *     Encrypted message encoded as binary string.
 */
mpenc.ske.smallrsasign = function(cleartext, privkey) {
    var keyLength = (privkey[2].length * 28 - 1) >> 5 << 2;
        
    // Convert to MPI format and return cipher as binary string.
    var data = mpenc.ske._pkcs1v15_encode(cleartext, keyLength);
    // Decrypt ciphertext.
    var cipher = RSAdecrypt(mpenc.ske._binstring2mpi(data),
                            privkey[2], privkey[0], privkey[1], privkey[3]);
    return mpenc.ske._mpi2binstring(cipher);
};


/**
 * Encrypts a binary string using an RSA public key. The data to be encrypted
 * must be encryptable <em>directly</em> using the key.
 * 
 * @param ciphertext
 *     Ciphertext to encrypt.
 * @param pubkey
 *     Public RSA key.
 * @returns
 *     Cleartext encoded as binary string.
 */
mpenc.ske.smallrsaverify = function(ciphertext, pubkey) {
    // Convert to MPI format and return cleartext as binary string.
    var data = mpenc.ske._binstring2mpi(ciphertext);
    var cleartext = mpenc.ske._mpi2binstring(RSAencrypt(data, pubkey[1], pubkey[0]));
    return mpenc.ske._pkcs1v15_decode(cleartext);
};


/**
 * Encrypts a binary string using an RSA public key. The data to be encrypted
 * must be encryptable <em>directly</em> using the key.
 * 
 * @param members
 *     Members participating in protocol.
 * @param nonces
 *     Nonces of the members in matching order.
 * @returns
 *     Session ID as binary string.
 */
mpenc.ske._computeSid = function(members, nonces) {
    // Create a mapping to access sorted/paired items later.
    var mapping = {};
    for (var i = 0; i < members.length; i++) {
        mapping[members[i]] = nonces[i];
    }
    var sortedMembers = members.concat();
    sortedMembers.sort();
    
    // Compose the item chain.
    var pidItems = '';
    var nonceItems = '';
    for (var i = 0; i < sortedMembers.length; i++) {
        var pid = sortedMembers[i];
        pidItems += pid;
        nonceItems += mapping[pid];
    }
    return sjcl.codec.bytes.fromBits(sjcl.hash.sha256.hash(pidItems + nonceItems));
};