import {API_BACKEND} from "./env";

class Api {

    constructor() {
        this.accessToken = null;
        this.username = null;
        this.password = null;
    }

    fetchConfig = () =>
        this.logAndParse('fetch config', fetch(this.urlFor('/v2/config'), this.defaultOptions()));

    fetchAvailableRooms = () =>
        this.logAndParse('fetch available rooms', fetch(this.urlFor('/groups'), this.defaultOptions()));

    fetchActiveRooms = () =>
        this.logAndParse('fetch active rooms', fetch(this.urlFor('/rooms'), this.defaultOptions()));

    fetchRoom = (id) =>
        this.logAndParse(`fetch room ${id}`, fetch(this.urlFor(`/room/${id}`), this.defaultOptions()));

    fetchUsers = () =>
        this.logAndParse('fetch users', fetch(this.urlFor('/users'), this.defaultOptions()));

    fetchQuad = (col) =>
        this.logAndParse(`fetch quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), this.defaultOptions()));

    fetchProgram = (col) =>
        this.logAndParse(`fetch program ${col}`, fetch(this.urlFor(`/qids`), this.defaultOptions()));

    updateQuad = (col, data) => {
        const options = {
            ...this.defaultOptions(),
            method: 'PUT',
            body: JSON.stringify(data),
        };
        options.headers['Content-Type'] = 'application/json';
        return this.logAndParse(`update quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), options));
    }

    urlFor = (path) => (API_BACKEND + path)

    defaultOptions = () => {
        const auth = this.accessToken ?
            `Bearer ${this.accessToken}` :
            `Basic ${btoa(`${this.username}:${this.password}`)}`;

        return {
            headers: {
                'Authorization': auth,
            }
        };
    };

    logAndParse = (action, fetchPromise) => {
        return fetchPromise
            .then(response => {
                if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response.json();
            })
            .then(data => {
                console.debug(`[API] ${action} success`, data);
                return data;
            })
            .catch(err => {
                console.error(`[API] ${action} error`, err);
                return Promise.reject(err);
            });
    }

    setAccessToken = (token) => {
        this.accessToken = token;
    }

    setBasicAuth = (username, password) => {
        this.username = username;
        this.password = password;
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
