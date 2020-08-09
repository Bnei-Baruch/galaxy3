import React, {Component} from 'react';
import './VirtualWorkshopQuestion.scss'
import {withTranslation} from 'react-i18next';
import classNames from 'classnames';
import Dropdown from 'semantic-ui-react/dist/commonjs/modules/Dropdown';
import Flag from 'semantic-ui-react/dist/commonjs/elements/Flag';
import Button from 'semantic-ui-react/dist/commonjs/elements/Button';
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon';
import Slider from 'react-rangeslider'
import ReconnectingWebSocket from 'reconnectingwebsocket';
import {GET_WORKSHOP_QUESTIONS, WEB_SOCKET_WORKSHOP_QUESTION} from '../../shared/env';

const WQ_FONT_SIZE = 'wq-font-size';
const WQ_LANG = 'wq-lang';
const WQ_IN_PROCESS_SELECTED = 'wq-in-process-selected';
const GALAXY_LANG = 'lng';

const languageOptions = [
  {key: 'he', value: 0, flag: 'il', question: null, selected: false},
  {key: 'ru', value: 1, flag: 'ru', question: null, selected: false},
  {
    key: 'en',
    value: 2,
    flag: 'us',
    question: 'What is unity? What is unity? What is unity? What is unity?',
    selected: false
  },
  {key: 'es', value: 3, flag: 'es', question: 'Es', selected: false}
];

const getLanguageValue = () => {
  const storageLang = parseInt(localStorage.getItem(WQ_LANG));
  const galaxyLang = localStorage.getItem(GALAXY_LANG);
  let langValue = 2;
  if (!isNaN(storageLang)) {
    langValue = storageLang;
  } else if (galaxyLang) {
    const lang = languageOptions.find(l => l.key === galaxyLang);
    if (lang) {
      langValue = lang.value;
      localStorage.setItem(WQ_LANG, lang.value);
    }
  }

  return langValue;
};

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    this.websocket = null;

    const inProcessStored = JSON.parse(localStorage.getItem(WQ_IN_PROCESS_SELECTED));
    let inProcessSelected = [];
    if (inProcessStored) {
      languageOptions.forEach(l => l.selected = inProcessStored.indexOf(l.value) !== -1);
      inProcessSelected = languageOptions.filter(l => l.selected);
    }

    this.state = {
      fontSize: +localStorage.getItem(WQ_FONT_SIZE) || 18,
      selectedLanguageValue: getLanguageValue(),
      hasQuestion: true,
      showQuestion: true,
      openSettings: false,
      fontPopVisible: false,
      inProcessSelected
    };

    this.changeLanguage = this.changeLanguage.bind(this);
    this.manageFontSize = this.manageFontSize.bind(this);
    this.copyQuestion = this.copyQuestion.bind(this);
    this.closeWebsocket = this.closeWebsocket.bind(this);
    this.selectAvailableLanguage = this.selectAvailableLanguage.bind(this);
    this.onSettingsBlur = this.onSettingsBlur.bind(this);
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
    localStorage.setItem(WQ_LANG, value);
  }

  manageFontSize(value) {
    this.setState({fontSize: value, openSettings: true});
    localStorage.setItem(WQ_FONT_SIZE, value);
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

  selectAvailableLanguage(lang) {
    lang.selected = !lang.selected;

    const inProcessSelected = languageOptions.filter(l => l.selected);

    if (inProcessSelected.length) {
      localStorage.setItem(WQ_IN_PROCESS_SELECTED, JSON.stringify(inProcessSelected.map(l => l.value)));
    } else {
      localStorage.removeItem(WQ_IN_PROCESS_SELECTED);
    }

    this.setState({inProcessSelected});
  }

  onSettingsBlur(event) {
    if ((event.relatedTarget && event.relatedTarget.className === 'rangeslider__handle') || event.target.className === 'rangeslider__handle') return;
    this.setState({openSettings: false});
  }

  render() {
    const {t} = this.props;
    const {fontSize, selectedLanguageValue, hasQuestion, showQuestion, inProcessSelected, openSettings, fontPopVisible} = this.state;
    const {key, flag, question} = languageOptions[selectedLanguageValue];

    return (
      <div className={classNames('wq-overlay', {'overlay-visible': hasQuestion})}>
        <div className="wq-container">
          <div className={classNames('question-container', {'overlay-visible': showQuestion})}>
            <div className="wq__question" style={{fontSize: `${fontSize}px`}}>
              <div className={classNames('lang-question', {'show-question': question, rtl: key === 'he'})}>
                {question}
              </div>
              <div className={classNames('in-process', {'show-question': !question})}>
                <div className={classNames('in-process-text', {rtl: key === 'he'})}>
                  <span>{t('workshop.inProcess')} </span>
                  {languageOptions.filter(l => l.question).map(l =>
                    <Button className={l.selected ? 'selected' : ''}
                            compact
                            key={l.key}
                            content={<Flag name={l.flag}/>}
                            onClick={() => this.selectAvailableLanguage(l)}
                    />
                  )}
                </div>
                {inProcessSelected.map(l =>
                  <div key={l.value} className={classNames('other-question', {rtl: l.key === 'he'})}>{l.question}</div>
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
                        onChange={(event, data) => this.changeLanguage(data)}
                        trigger={<Flag name={flag}/>}
              />
              <Dropdown className="wq-settings"
                        upward
                        compact
                        icon={null}
                        open={openSettings}
                        selectOnBlur={false}
                        trigger={
                          <Icon name="cog"
                                onClick={() => this.setState(prevState => ({
                                  openSettings: !prevState.openSettings,
                                  fontPopVisible: false
                                }))}
                          />
                        }
                        onBlur={event => this.onSettingsBlur(event)}
              >
                <Dropdown.Menu>
                  <Dropdown.Item className="manage-font-size">
                    <div className="manage-font-size-pop__container"
                         style={{visibility: fontPopVisible ? 'visible' : 'hidden'}}>
                      <div className="manage-font-size-pop__context">
                        <Icon name="font" className="decrease-font" aria-hidden="true"/>
                        <Slider
                          min={16}
                          max={50}
                          value={fontSize}
                          tooltip={false}
                          onChange={value => this.manageFontSize(value)}
                        />
                        <Icon name="font" className="increase-font" aria-hidden="true"/>
                      </div>
                    </div>
                    <Icon id="manage-font-size"
                          name="font"
                          title={t('workshop.manageFontSize')}
                          onClick={() => this.setState(prevState => ({fontPopVisible: !prevState.fontPopVisible}))}
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
                          onClick={() => this.setState({showQuestion: false})}
                    />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
          <div className={classNames('show-wq', {'overlay-visible': !showQuestion})}>
            <Button compact
                    icon="eye"
                    title={t('workshop.showQuestion')}
                    onClick={() => this.setState({showQuestion: true})}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);
