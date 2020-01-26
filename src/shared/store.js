let store = {};

export const getStore = () => {
    return store;
};

export const setStore = (data) => {
    store = {...data};
};