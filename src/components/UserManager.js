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
console.log(kc)

kc.onTokenExpired = () => {
    console.log('Renew token..');
    kc.updateToken(70)
        .then(refreshed => {
            if (refreshed) {
                console.log(kc);
                api.setAccessToken(kc.token);
            } else {
                console.log('Token is still valid?..');
            }
        })
        .catch(err => {
            console.log("Refresh token failed: " + err);
            api.setAccessToken(null);
            kc.logout();
        });
};

export const getUser = (callback) => {
    kc.init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        flow: 'standard',
    }).then(authenticated => {
            if(authenticated) {
                kc.loadUserProfile().then(profile => {
                    const {realm_access: {roles},sub,given_name,name,email} = kc.tokenParsed;
                    const {pending, request, timestamp: request_timestamp,group,title} = profile.attributes;
                    const user = {
                        id: sub, title: title ? title[0] : given_name, username: given_name,
                        email, group: group ? group[0] : undefined, name, pending, request, request_timestamp, roles,
                    };
                    api.setAccessToken(kc.token);
                    callback(user)
                })
            } else {
                callback(null)
            }
        })
        .catch((err) => console.log(err));
};

export default kc;
