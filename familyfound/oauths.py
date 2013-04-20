#!/usr/bin/env python

import urlparse
import urllib
import urllib2
import random
import time
import logging

auth_endpoint = 'https://sandbox.familysearch.org/cis-web/oauth2/v3/authorization'

URLS = {}
for one in ('request_token', 'authorize', 'access_token'):
    URLS[one] = 'https://api.familysearch.org/identity/v2/' + one

def make_request(data, url):
    url = URLS[url] + '?' + urllib.urlencode(data)
    logging.info('OAUTH: requesting url ' + url)
    req = urllib2.urlopen(url)
    if req.code != 200:
        # server error
        raise Exception('Invalid response from server: %s' % vars(req))
    text = req.read()
    logging.info('OAUTH: response: ' + text)
    result = urllib2.urlparse.parse_qs(text)
    return result

def request_token(key, redirect='https://familyfound.herokuapp.com'):
    data = data_request_token(key, redirect)
    result = make_request(data, 'request_token')
    return result['oauth_token'][0], result['oauth_token_secret'][0]

def data_base():
    return {
        'oauth_signature_method': 'PLAINTEXT',
        'oauth_nonce': make_nonce(),
        'oauth_version': '1.0',
        'oauth_timestamp': int(time.time()),
        'oauth_signature': '&'
    }

def data_request_token(key, redirect):
    base = data_base()
    base.update({
        'oauth_callback': redirect,
        'oauth_consumer_key': key,
    })
    return base

def authorize_url(token):
    return URLS['authorize'] + '?oauth_token=' + token

def data_access_token(key, verifier, token, secret):
    base = data_base()
    base['oauth_verifier'] = verifier
    base['oauth_token'] = token
    base['oauth_signature'] = '&' + secret
    base['oauth_consumer_key'] = key
    return base

def access_token(key, verifier, token, secret):
    data = data_access_token(key, verifier, token, secret)
    result = make_request(data, 'access_token')
    return result['oauth_token'][0], result['oauth_token_secret'][0]

def make_nonce():
    return str(random.randint(0, 10**10))

