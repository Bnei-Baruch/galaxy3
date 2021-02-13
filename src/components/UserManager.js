import Keycloak from 'keycloak-js';
import api from '../shared/Api';
import {captureMessage, updateSentryUser} from '../shared/sentry'

const userManagerConfig = {
    url: 'https://accounts.kab.info/auth',
    realm: 'main',
    clientId: 'galaxy',
    scope: 'profile',
    enableLogging: true,
};

export const kc = new Keycloak(userManagerConfig);

kc.onTokenExpired = () => {
    console.debug(" -- Renew token -- ");
    renewToken(0);
};

kc.onAuthLogout = () => {
    console.debug("-- Detect clearToken --");
    api.setAccessToken(null);
    kc.logout();
};

const renewToken = (retry) => {
    retry++;
    kc.updateToken(70)
        .then(refreshed => {
            if(refreshed) {
                console.debug("-- Refreshed --");
                api.setAccessToken(kc.token);
            } else {
                console.warn('Token is still valid?..');
                captureMessage('Refresh valid token', {source: 'kc', refreshed}, 'fatal');
                renewRetry(retry, refreshed);
            }
        })
        .catch(err => {
            renewRetry(retry, err);
        });
};

const renewRetry = (retry, err) => {
    if(retry > 5) {
        captureMessage('Error refresh token', {source: 'kc', err}, 'fatal');
        console.error("Refresh retry: failed");
        console.debug("-- Refresh Failed --");
        kc.clearToken();
        window.location.reload();
    } else {
        setTimeout(() => {
            console.error("Refresh retry: " + retry);
            renewToken(retry);
        }, 10000);
    }
};

export const getUser = (callback) => {
    kc.init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        flow: 'standard',
        pkceMethod: 'S256',
    }).then(authenticated => {
        if(authenticated) {
            kc.loadUserProfile()
                .then(profile => {
                    const {realm_access: {roles}, sub, given_name, name, email, family_name} = kc.tokenParsed;
                    const {group,title} = profile.attributes;
                    const user = {
                        name, email, roles, id: sub, username: given_name, familyname: family_name,
                        display: title && !!title[0] ? title[0] : name,
                        group: group && !!group[0] ? group[0] : "",
                    };
                    api.setAccessToken(kc.token);
                    updateSentryUser(user);
                    callback(user)
                })
        } else {
            callback(null)
        }
    }).catch((err) => console.log(err));
};

export default kc;
