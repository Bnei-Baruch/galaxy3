let store = {
    qst: false,
    feed: {},
    group: {},
    col: null
};

export const getStore = () => {
    return store;
};

export const setStore = (data) => {
    store = {...data};
};