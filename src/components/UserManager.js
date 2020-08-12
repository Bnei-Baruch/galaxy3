import Keycloak from 'keycloak-js';
import api from '../shared/Api';

const userManagerConfig = {
    url: 'https://accounts.kbb1.com/auth',
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
}

const renewToken = (retry) => {
    kc.updateToken(70)
        .then(refreshed => {
            if(refreshed) {
                console.debug("-- Refreshed --");
                api.setAccessToken(kc.token);
            } else {
                console.warn('Token is still valid?..');
            }
        })
        .catch(err => {
            retry++;
            if(retry > 5) {
                console.error("Refresh retry: failed");
                console.debug("-- Refresh Failed --");
                kc.clearToken();
            } else {
                setTimeout(() => {
                    console.error("Refresh retry: " + retry);
                    renewToken(retry);
                }, 10000);
            }
        });
}

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
                    const {realm_access: {roles},sub,given_name,name,email} = kc.tokenParsed;
                    const {pending, request, timestamp: request_timestamp,group,title} = profile.attributes;
                    const user = {
                        name, email, pending, request, request_timestamp, roles,
                        id: sub, username: given_name,
                        display: title && !!title[0] ? title[0] : name,
                        group: group && !!group[0] ? group[0] : "",
                    };
                    api.setAccessToken(kc.token);
                    callback(user)
                })
        } else {
            callback(null)
        }
    }).catch((err) => console.log(err));
};

export default kc;
