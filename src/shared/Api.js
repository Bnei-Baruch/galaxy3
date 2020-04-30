import {API_BACKEND} from "./env";

class Api {

    constructor() {
        this.accessToken = null;
    }

    fetchConfig = () =>
        this.logAndParse('fetch config', fetch(this.urlFor('/v2/config'), this.defaultOptions()));

    fetchAvailableRooms = () =>
        this.logAndParse('fetch available rooms', fetch(this.urlFor('/groups'), this.defaultOptions()));

    urlFor = (path) => (API_BACKEND + path)

    defaultOptions = () => ({
        headers: {
            'Authorization': `Bearer ${this.accessToken}`,
        }
    })

    logAndParse = (action, fetchPromise) => {
        return fetchPromise
            .then(response => response.json())
            .then(data => {
                console.debug(`[API] ${action} success`, data);
                return data;
            })
            .catch(err => {
                console.error(`[API] ${action} error`, err);
                return err;
            });
    }

    setAccessToken = (token) => {
        this.accessToken = token;
    }
}

// Helpers for tests / local dev
class MockApi {
    fetchConfig = () =>
        new Promise((resolve, reject) => resolve({
            gateways: [{name: "gxytest", url: "http://localhost:8088/janus", type: "rooms", token: "secret"}],
            ice_servers: [],
        }))
}

// const defaultApi = new MockApi();

const defaultApi = new Api();

export default defaultApi;
