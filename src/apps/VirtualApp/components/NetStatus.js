const CHK_TIME    = 5000;
const GOOD        = 0;
const BAD         = 100;

let list = [];
let chk = null;
let status = 0;

export const addLostStat = (lost) => {

    const now = Date.now();
    list.push({ timestamp: now, lost: lost });

    if(chk) return;

    chk = setInterval(() => {

        const now = Date.now();

        if (now - list[0].timestamp > CHK_TIME) {
            list.shift();
        }

        if(list.length === 0) {
            clearInterval(chk);
            chk = null;
        }

        status = list.map(r => r.lost).reduce((s, c) => s + c, 0);

    }, 1000);
}

export const getLostStat = () => {
    if(status === GOOD) {
        return 1;
    }
    if(status > GOOD && status < BAD) {
        return 2;
    }
    if(status > BAD) {
        return 3;
    }
}