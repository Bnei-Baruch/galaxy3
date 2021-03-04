export const MSGS_TYPES = {
  subtitle: 'subtitle',
  workshop: 'workshop'
};

export class MessageManager {

  wqMsgs       = [];
  subtitleMsgs = [];

  constructor() {
    this.push              = this.push.bind(this);
    this.clear             = this.clear.bind(this);
    this.last              = this.last.bind(this);
    this.getWQByLang       = this.getWQByLang.bind(this);
    this.getAvailableLangs = this.getAvailableLangs.bind(this);
  }

  push(data, lang) {
    const { message, language, type } = data;
    const msg                         = { message, type, language, addedAt: Date.now() };

    switch (type) {
    case MSGS_TYPES.subtitle:
      this.subtitleMsgs = [msg];
      break;
    case MSGS_TYPES.workshop:
      const i = this.wqMsgs.findIndex(m => m.language === language);
      (i > -1) && this.wqMsgs.splice(i, 1);
      this.wqMsgs.push(msg);
      break;
    }
    return this.last(lang);
  }

  clear({ type }, language) {
    switch (type) {
    case MSGS_TYPES.subtitle:
      this.subtitleMsgs = [];
      break;
    case MSGS_TYPES.workshop:
      this.wqMsgs = [];
      break;
    }
    return this.last(language);
  }

  last(lang) {
    return [...this.subtitleMsgs, ...this.wqMsgs]
      .filter(m => m.language === lang)
      .sort((a, b) => b.addedAt - a.addedAt)
      [0];
  }

  getWQByLang(lang) {
    return this.wqMsgs.find(m => m.language === lang);
  }

  getAvailableLangs() {
    return this.wqMsgs.map(m => m.language);
  }
};
