import React, { Component } from 'react';
import './VirtualWorkshopQuestion.scss';
import { withTranslation } from 'react-i18next';
import classNames from 'classnames';
import Dropdown from 'semantic-ui-react/dist/commonjs/modules/Dropdown';
import Flag from 'semantic-ui-react/dist/commonjs/elements/Flag';
import Button from 'semantic-ui-react/dist/commonjs/elements/Button';
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon';
import Slider from 'react-rangeslider';
import ReconnectingWebSocket from 'reconnectingwebsocket';
import { GET_WORKSHOP_QUESTIONS, WEB_SOCKET_WORKSHOP_QUESTION } from '../../../shared/env';
import { getLanguage } from '../../../i18n/i18n';
import mqtt from '../../../shared/mqtt';
import { MessagesForShowStack, MSGS_TYPES } from './MessagesForShowStack';

const WQ_FONT_SIZE           = 'wq-font-size';
const WQ_LANG                = 'wq-lang';
const WQ_IN_PROCESS_SELECTED = 'wq-in-process-selected';
const EQUAL                  = 'equal';
const FULLSCREEN             = 'fullscreen';
const DETACHED               = 'detached';

class Language {
  constructor(key, value, flag) {
    this.key      = key;
    this.value    = value;
    this.flag     = flag;
    this.question = null;
    this.selected = false;
  }
}

class FontSize {
  constructor(min, max, current) {
    this.min     = min;
    this.max     = max;
    this.current = current > max ? max : current;
  }
}

const setLanguageOptions = () => {
  const languageOptions = [
    new Language('he', 0, 'il'),
    new Language('ru', 1, 'ru'),
    new Language('en', 2, 'us'),
    new Language('es', 3, 'es')
  ];

  const selected = JSON.parse(localStorage.getItem(WQ_IN_PROCESS_SELECTED));
  if (selected) {
    languageOptions.forEach(l => l.selected = selected.indexOf(l.value) !== -1);
  }

  return languageOptions;
};

const getSelectedLanguageItem = (languageOptions, playerLang) => {
  const storageLang = parseInt(localStorage.getItem(WQ_LANG));
  let langValue     = 2;

  if (!isNaN(storageLang)) {
    langValue = storageLang;
  } else if (playerLang) {
    const lang = languageOptions.find(l => l.key === playerLang);
    if (lang) {
      langValue = lang.value;
    }
  }

  return languageOptions[langValue];
};

const setFontSize = (layout, current) => {
  switch (layout) {
  case EQUAL:
    return new FontSize(16, 20, current || 16);
  case FULLSCREEN:
    return new FontSize(30, 40, current || 34);
  case DETACHED:
    return new FontSize(20, 40, current || 24);
  default:
    return new FontSize(20, 28, current || 24);
  }
};

let currentLayout = localStorage.getItem('currentLayout') || EQUAL;

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    const languageOptions      = setLanguageOptions();
    const selectedLanguageItem = getSelectedLanguageItem(languageOptions, props.playerLang);
    this.msgStack              = new MessagesForShowStack(selectedLanguageItem.key);

    this.state = {
      languageOptions,
      selectedLanguageValue: selectedLanguageItem.value,
      fontSize: setFontSize(currentLayout, +localStorage.getItem(WQ_FONT_SIZE)),
      mountView: false,
      showQuestion: true,
      openSettings: false,
      fontPopVisible: false,
      lastMsgAddedAt: 0
    };

    this.websocket         = null;
    this.websocketAttempts = 0;

    this.changeLanguage             = this.changeLanguage.bind(this);
    this.manageFontSize             = this.manageFontSize.bind(this);
    this.copyQuestion               = this.copyQuestion.bind(this);
    this.selectAvailableLanguage    = this.selectAvailableLanguage.bind(this);
    this.onSettingsBlur             = this.onSettingsBlur.bind(this);
    this.resetWebsocketAttempts     = this.resetWebsocketAttempts.bind(this);
    this.incrementWebsocketAttempts = this.incrementWebsocketAttempts.bind(this);
    this.onWebsocketOpen            = this.onWebsocketOpen.bind(this);
    this.onWebsocketMessage         = this.onWebsocketMessage.bind(this);
    this.closeWebsocket             = this.closeWebsocket.bind(this);
    this.clearQuestions             = this.clearQuestions.bind(this);
    this.unmountView                = this.unmountView.bind(this);
  }

  componentDidMount() {
    this.websocket                                   = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);
    this.websocket.onopen                            = this.onWebsocketOpen;
    this.websocket.onmessage                         = this.onWebsocketMessage;
    const { selectedLanguageValue, languageOptions } = this.state;
    const lang                                       = languageOptions[selectedLanguageValue];
    this.updateMqttLang(null, lang.key);
    window.addEventListener('beforeunload', this.closeWebsocket);
  }

  componentWillUnmount() {
    this.closeWebsocket();
    window.removeEventListener('beforeunload', this.closeWebsocket);
    if (mqtt && mqtt.mq) {
      mqtt.mq.off('MqttSubtitlesEvent', this.msgStack.pushSubtitles);
      mqtt.exit('subtitles/galaxy/' + this.msgStack.lang);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.layout !== currentLayout) {
      currentLayout  = this.props.layout;
      const fontSize = setFontSize(this.props.layout);
      this.setState({ fontSize });
      localStorage.setItem(WQ_FONT_SIZE, fontSize.current);
    }
    if (this.props.playerLang !== prevProps.playerLang) {
      const lang = getSelectedLanguageItem(this.state.languageOptions, this.props.playerLang);
      (lang.value !== prevState.selectedLanguageValue) && this.changeLanguage(lang, false);
    }
    const last = this.msgStack.last();
    if (!last) {
      if (prevState.lastMsgAddedAt !== 0) {
        this.setState({ lastMsgAddedAt: 0 });
        this.printLast();
      }
    } else if (prevState.lastMsgAddedAt !== last.addedAt) {
      this.setState({ lastMsgAddedAt: last.addedAt });
      this.printLast();
    }
  }

  clearQuestions() {
    this.setState(({ languageOptions }) => ({
      languageOptions: languageOptions.map(l => ({ ...l, question: null }))
    }));
  }

  unmountView() {
    setTimeout(() => this.setState({ mountView: false }), 1000);
  }

  setWsAttempts(value) {
    this.wsAttempts = value;
  }

  resetWebsocketAttempts() {
    this.websocketAttempts = 0;
  }

  incrementWebsocketAttempts() {
    this.websocketAttempts++;
  }

  onWebsocketOpen() {
    if (this.websocketAttempts > 2) return;
    this.incrementWebsocketAttempts();

    fetch(GET_WORKSHOP_QUESTIONS)
      .then(response => response.json())
      .then(data => {
        const questions = data.questions.filter(q => q.message);
        if (!questions.length) {
          this.clearQuestions();
          return;
        }

        this.resetWebsocketAttempts();

        const { selectedLanguageValue, languageOptions } = this.state;
        const selLang                                    = languageOptions[selectedLanguageValue];
        this.setState(({ languageOptions }) => ({
          mountView: true,
          languageOptions: languageOptions.map(l => {
            const current = questions.find(a => a.language === l.key && a.language !== selLang.key);
            if (current) {
              l.question = current.message;
            }

            return l;
          })
        }));
        const l = languageOptions[selLang.value];
        this.msgStack.pushWorkshop({ message: l.question, language: l.key });
      })
      .catch(e => console.error('Could not get workshop questions', e));
  }

  onWebsocketMessage(event) {
    this.resetWebsocketAttempts();
    try {
      let wsData = JSON.parse(event.data);
      if (wsData.questions === null) {
        wsData = { clear: true };
      }
      if (wsData.questions?.length > 0) {
        wsData = wsData.questions.find(q => q.language === this.msgStack.lang);
      }
      this.msgStack.pushWorkshop(wsData);
    } catch (e) {
      console.error('Workshop onmessage parse error', e);
    }
  }

  closeWebsocket() {
    this.websocket && this.websocket.close();
  }

  printLast() {
    let last = this.msgStack.last();
    console.log('VirtualWorkshopQuestion printLast last: ', last);
    if (!last)
      last = { message: null };
    const { message, type }   = last;
    const { languageOptions } = this.state;
    const lang                = languageOptions.find(l => l.key === this.msgStack.lang);
    if (!lang) return;
    lang.type     = type;
    lang.question = message;
    this.setState({ languageOptions, mountView: true });
  }

  changeLanguage({ value }, save) {
    const prevKey = this.msgStack.lang;
    const next    = this.state.languageOptions[value];

    this.msgStack = new MessagesForShowStack(next.key);
    (next.type === MSGS_TYPES.workshop) && this.msgStack.pushWorkshop({ message: next.question, language: next.key });
    this.updateMqttLang(prevKey, next.key);
    this.setState({ selectedLanguageValue: value });
    save && localStorage.setItem(WQ_LANG, value);
  }

  manageFontSize(current) {
    this.setState(({ fontSize }) => ({ fontSize: { ...fontSize, current } }));
    localStorage.setItem(WQ_FONT_SIZE, current);
  }

  copyQuestion(question) {
    navigator.clipboard.writeText(question)
      .then(function () {
      }, function () {
        alert('Could not copy the question');
      });
  }

  selectAvailableLanguage(lang) {
    lang.selected = !lang.selected;

    const { languageOptions } = this.state;
    const selected            = languageOptions.filter(l => l.selected);

    if (selected.length) {
      localStorage.setItem(WQ_IN_PROCESS_SELECTED, JSON.stringify(selected.map(l => l.value)));
    } else {
      localStorage.removeItem(WQ_IN_PROCESS_SELECTED);
    }

    this.setState({});
  }

  onSettingsBlur({ relatedTarget }) {
    if (!relatedTarget) {
      this.setState({ openSettings: false });
    }
  }

  updateMqttLang = (prevLang, nextlang) => {
    if (prevLang === nextlang)
      return;

    prevLang && mqtt.exit('subtitles/galaxy/' + prevLang);

    mqtt.join('subtitles/galaxy/' + nextlang);

    mqtt.mq.on('MqttSubtitlesEvent', this.msgStack.pushSubtitles.bind(this.msgStack));
  };

  render() {
    const { t }                   = this.props;
    const {
            mountView,
            fontSize,
            selectedLanguageValue,
            showQuestion,
            openSettings,
            fontPopVisible,
            languageOptions
          }                       = this.state;
    const hasQuestion             = !!languageOptions.find(l => l.question);
    const { key, flag, question } = languageOptions[selectedLanguageValue];
    const galaxyLang              = getLanguage();

    if (!hasQuestion) {
      if (!mountView) return null;
      this.unmountView();
    }

    return (
      <div className={classNames('wq-overlay', { 'overlay-visible': hasQuestion })}>
        <div className="wq-container">
          <div className={classNames('question-container', { 'overlay-visible': showQuestion })}>
            <div className="wq__question" style={{ fontSize: `${fontSize.current}px` }}>
              <div
                className={classNames('lang-question slide', { 'show-question': question, rtl: key === 'he' })}
                dangerouslySetInnerHTML={{ __html: question }}
              />
              <div className={classNames('in-process', { 'show-question': !question && hasQuestion })}>
                <div className={classNames('in-process-text', { rtl: galaxyLang === 'he' })}>
                  <span>{t('workshop.inProcess')} </span>
                  {languageOptions.filter(l => l.question).map(l =>
                    <Button className={l.selected ? 'selected' : ''}
                            compact
                            key={l.key}
                            content={<Flag name={l.flag} />}
                            onClick={() => this.selectAvailableLanguage(l)}
                    />
                  )}
                </div>
                {languageOptions.filter(l => l.question && l.selected).map(l =>
                  <div key={l.key} className={classNames('other-question', { rtl: l.key === 'he' })}>
                    {l.question}
                  </div>
                )}
              </div>
            </div>
            <div className="wq__toolbar">
              <Dropdown defaultValue={selectedLanguageValue}
                        selectOnBlur={false}
                        icon={null}
                        upward
                        compact
                        options={languageOptions}
                        onChange={(event, data) => this.changeLanguage(data, true)}
                        trigger={<Flag name={flag} />}
              />
              <Dropdown className="wq-settings"
                        upward
                        compact
                        icon={null}
                        open={openSettings}
                        selectOnBlur={false}
                        trigger={
                          <Icon name="cog"
                                onClick={() => this.setState(({ openSettings }) => ({
                                    openSettings: !openSettings,
                                    fontPopVisible: false
                                  })
                                )}
                          />
                        }
                        onBlur={event => this.onSettingsBlur(event)}
              >
                <Dropdown.Menu>
                  <Dropdown.Item className="manage-font-size">
                    <div className="manage-font-size-pop__container"
                         style={{ visibility: fontPopVisible ? 'visible' : 'hidden' }}>
                      <div className="manage-font-size-pop__context">
                        <Icon name="font" className="decrease-font" aria-hidden="true" />
                        <Slider
                          min={fontSize.min}
                          max={fontSize.max}
                          value={fontSize.current}
                          tooltip={false}
                          onChange={value => this.manageFontSize(value)}
                        />
                        <Icon name="font" className="increase-font" aria-hidden="true" />
                      </div>
                    </div>
                    <Icon id="manage-font-size"
                          name="font"
                          title={t('workshop.manageFontSize')}
                          onClick={(e) => {
                            this.setState(({ fontPopVisible }) => ({ fontPopVisible: !fontPopVisible }));
                            e.stopPropagation();
                          }}
                    />
                  </Dropdown.Item>
                  <Dropdown.Item disabled={!question}>
                    <Icon name="copy outline"
                          title={t('workshop.copyQuestion')}
                          onClick={() => this.copyQuestion(question)}
                    />
                  </Dropdown.Item>
                  <Dropdown.Item>
                    <Icon name="eye slash"
                          title={t('workshop.hideQuestion')}
                          onClick={() => this.setState({ showQuestion: false })}
                    />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
          <div className={classNames('show-wq', { 'overlay-visible': !showQuestion })}>
            <Button compact
                    icon="eye"
                    title={t('workshop.showQuestion')}
                    onClick={() => this.setState({ showQuestion: true })}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);
