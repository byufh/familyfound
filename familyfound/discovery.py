#!/usr/bin/env python3

import json

from urllib.parse import urlencode
from urllib.request import urlopen, Request


# parse.parse_qs
# parse.urlencode

class UrlHandler:
    '''This is a base handler for all urls'''

    BASE = 'familysearch.org/.well-known/app-meta'
    headers = {
        'accept': 'application/json'
    }

    def __init__(self, sandbox, extra_headers={}, override_urls=None):
        if extra_headers:
            self.headers = self.headers.copy()
            self.headers.update(extra_headers)
        if override_urls is not None:
            self.urls = override_urls
        else:
            self.urls = {}
            self.cache_urls(sandbox)

    def cache_urls(self, sandbox):
        '''This gets cached. You need to call this from your application before
        using any other functions in this module'''

        pref = 'sandbox.' if sandbox else ''
        url = 'https://' + pref + self.BASE
        req = Request(url, headers=self.headers)
        result = urlopen(req).read().decode('utf8')
        self.urls = json.loads(result)['links']

    def make_url(self, name, params):
        '''Make a url from a resource name and a query dictionary'''

        if name not in self.urls:
            raise ValueError('Tried to retrieve unknown resource "%s"' % name)
        return self.urls[name]['href'] + '?' + urlencode(params)

    def make_request(self, name, params={}, extra_headers={}):
        '''Make a request (keeps track of HTTP headers)'''

        headers = self.headers.copy()
        headers.update(extra_headers)
        return Request(self.make_url(name, params), headers=headers)

    def fetch_json(self, name, params, extra_headers):
        '''Get the json request'''

        res = self.make_request(name, params, extra_headers)
        return json.loads(urlopen(res).read().decode('utf8'))

class OAuthHandler(UrlHandler):
    '''This introduces the reliance on an API_KEY'''

    def __init__(self, api_key, sandbox, extra_headers={}, override_urls=None):
        super().__init__(sandbox, extra_headers, override_urls)
        self.api_key = api_key

    def oauth_authorize_url(self, redirect_uri):
        '''Get the url to authorize.
        
        You then need to show this url to the user and then FS will call your
        redirect_uri with the access token'''

        params = {
            'response_type': 'code',
            'client_id': self.api_key,
            'redirect_uri': redirect_uri
        }
        return self.make_url('http://oauth.net/core/2.0/endpoint/authorize', params)

    def oauth_access_token(self, code):
        '''Get the access token from an OATH code
        
        This takes the code that you got from the oauth response [from the
        authorize url]'''

        params = {
            'grant_type': 'authorization_code',
            'client_id': self.api_key,
            'code': code
        }
        data = self.fetch_json('http://oauth.net/core/2.0/endpoint/token', params)
        return data['access_token']

# vim: et sw=4 sts=4
