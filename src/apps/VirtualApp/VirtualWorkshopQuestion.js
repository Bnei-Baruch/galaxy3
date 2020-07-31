import React, {Component} from 'react';
import './VirtualWorkshopQuestion.scss'
import {withTranslation} from 'react-i18next';
import Dropdown from 'semantic-ui-react/dist/commonjs/modules/Dropdown';
import Flag from 'semantic-ui-react/dist/commonjs/elements/Flag';
import Button from 'semantic-ui-react/dist/commonjs/elements/Button';
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon';
import classNames from 'classnames';
import ReconnectingWebSocket from 'reconnectingwebsocket';
import {GET_WORKSHOP_QUESTIONS, WEB_SOCKET_WORKSHOP_QUESTION} from '../../shared/env';
import {Slider} from 'react-semantic-ui-range';

const WS_FONT_SIZE = 'ws-font-size';
const WS_LANG = 'ws-lang';
const GALAXY_LANG = 'lng';

const languageOptions = [
  {key: 'he', value: 0, flag: 'il', question: null, text: 'עברית'},
  {key: 'ru', value: 1, flag: 'ru', question: null, text: 'Русский'},
  {key: 'en', value: 2, flag: 'us', question: null, text: 'English'},
  {key: 'es', value: 3, flag: 'es', question: null, text: 'Español'}
];

const getLanguageValue = () => {
  const storageLang = parseInt(localStorage.getItem(WS_LANG));
  const galaxyLang = localStorage.getItem(GALAXY_LANG);
  let langValue = 2;
  if (!isNaN(storageLang)) {
    langValue = storageLang;
  } else if (galaxyLang) {
    const lang = languageOptions.find(l => l.key === galaxyLang);
    if (lang) langValue = lang.value;
  }

  return langValue;
};

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fontSize: +localStorage.getItem(WS_FONT_SIZE) || 18,
      selectedLanguageValue: getLanguageValue(),
      hasQuestion: false,
      showQuestion: true
    };

    this.websocket = null;

    this.changeLanguage = this.changeLanguage.bind(this);
    this.manageFontSize = this.manageFontSize.bind(this);
    this.copyQuestion = this.copyQuestion.bind(this);
    this.closeWebsocket = this.closeWebsocket.bind(this);
  }

  componentDidMount() {
    fetch(GET_WORKSHOP_QUESTIONS)
      .then(response => response.json())
      .then(data => {
        const approved = data.questions.filter(q => q.approved);
        if (!approved.length) return;

        let hasQuestion = false;
        languageOptions.forEach(l => {
          const current = approved.find(a => a.language === l.key);
          if (current) {
            l.question = current.message;
            hasQuestion = true;
          }
        });

        this.setState({hasQuestion});
      })
      .catch(e => console.error('Could not get workshop questions', e));

    this.websocket = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);

    this.websocket.onopen = () => console.log('Workshop websocket open');

    this.websocket.onmessage = event => {
      try {
        const wsData = JSON.parse(event.data);
        if (wsData.questions) {
          this.setState({hasQuestion: false});
          languageOptions.forEach(l => l.question = null);
          return;
        }

        const lang = languageOptions.find(l => l.key === wsData.language);
        if (!lang) return;

        let hasQuestion = true;
        lang.question = wsData.message;
        if (!wsData.approved) {
          lang.question = null;
          hasQuestion = !!languageOptions.find(l => l.question);
        }

        this.setState({hasQuestion});
      } catch (e) {
        console.error('Workshop onmessage parse error', e);
      }
    };

    window.addEventListener('beforeunload', this.closeWebsocket);
  }

  componentWillUnmount() {
    this.closeWebsocket();
    window.removeEventListener('beforeunload', this.closeWebsocket);
  }

  closeWebsocket() {
    this.websocket && this.websocket.close();
  }

  changeLanguage({value}) {
    this.setState({selectedLanguageValue: value});
    localStorage.setItem(WS_LANG, value);
  }

  manageFontSize(value) {
    this.setState({fontSize: value});
    localStorage.setItem(WS_FONT_SIZE, value);
  }

  copyQuestion(question) {
    try {
      const el = document.createElement('input');
      el.setAttribute('value', question);
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el)
    } catch (e) {
      alert('Could not copy the question');
    }
  }

  render() {
    const {t} = this.props;
    const {fontSize, selectedLanguageValue, hasQuestion, showQuestion} = this.state;
    const {key, flag, text, question} = languageOptions[selectedLanguageValue];

    return (
      <div className={classNames('workshop-question-overlay', {'overlay-visible': hasQuestion})}>
        <div className="workshop-container">
          <div className="manage-question-visibility">
            <Button icon={classNames('eye', {'slash': showQuestion})}
                    className={classNames({'question-hidden': !showQuestion})}
                    title={t(showQuestion ? 'workshop.hideQuestion' : 'workshop.showQuestion')}
                    onClick={() => this.setState({showQuestion: !showQuestion})}
            />
          </div>
          <div className={classNames('question-container', {'overlay-visible': showQuestion})}>
            <div className="workshop__toolbar">
              <Button compact
                      disabled={!question}
                      icon="copy outline"
                      title={t('workshop.copyQuestion')}
                      onClick={() => this.copyQuestion(question)}
              />
              <div className="manage-font-size">
                <div className="manage-font-size-pop__container">
                  <div className="manage-font-size-pop__context">
                    <Icon name="font" className="decrease-font" aria-hidden="true"/>
                    <Slider color="blue"
                            style={{width: '140px', thumb: {width: '16px', height: '16px', top: '3px'}}}
                            settings={{
                              min: 16,
                              max: 60,
                              start: fontSize,
                              step: 1,
                              onChange: value => this.manageFontSize(value)
                            }}
                    />
                    <Icon name="font" className="increase-font" aria-hidden="true"/>
                  </div>
                </div>
                <Button icon='font' title={t('workshop.manageFontSize')}/>
              </div>
              <Dropdown defaultValue={selectedLanguageValue}
                        selectOnBlur={false}
                        options={languageOptions}
                        onChange={(event, data) => this.changeLanguage(data)}
                        trigger={<span><Flag name={flag}/> {text}</span>}
              />
            </div>
            <div className="workshop__question" style={{fontSize: `${fontSize}px`}}>
              <div
                className={classNames('lang-question', {'show-question': question, rtl: key === 'he'})}>{question}</div>
              <div className={classNames('in-process', {'show-question': !question})}>
                <div className={classNames('in-process-text', {rtl: key === 'he'})}>{t('workshop.inProcess')}...</div>
                {languageOptions.filter(l => l.question).map(l => (
                  <div key={l.key} className={classNames('other-question', {rtl: l.key === 'he'})}>{l.question}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);
