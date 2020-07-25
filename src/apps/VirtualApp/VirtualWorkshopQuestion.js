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
import Transition from "semantic-ui-react/dist/commonjs/modules/Transition";
import Popup from "semantic-ui-react/dist/commonjs/modules/Popup";

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
    const lang = languageOptions.find((lang) => lang.value === galaxyLang);
    if (lang) langValue = lang.value;
  }

  return langValue;
}

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    this.state = {
      fontSize: +localStorage.getItem(WS_FONT_SIZE) || 18,
      disableIncreaseFontSize: false,
      disableDecreaseFontSize: false,
      selectedLanguageValue: getLanguageValue(),
      hasQuestion: false,
      showQuestion: true
    };

    this.websocket = null;

    this.displayQuestion = this.displayQuestion.bind(this);
    this.increaseFontSize = this.increaseFontSize.bind(this);
    this.decreaseFontSize = this.decreaseFontSize.bind(this);
    this.changeLanguage = this.changeLanguage.bind(this);
    this.copyQuestion = this.copyQuestion.bind(this);
  }

  componentDidMount() {
    fetch(GET_WORKSHOP_QUESTIONS)
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(e => console.log('Could not get workshop questions', e));
    this.websocket = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);

    this.websocket.onopen = () => console.log('Workshop websocket open');

    this.websocket.onmessage = event => {
      try {
        const wsData = JSON.parse(event.data);
        if (wsData.questions) {
          this.setState({hasQuestion: false});
          languageOptions.forEach(l => l.question = null);
        } else if (wsData.type === 'question') {
          const lang = languageOptions.find(l => l.key === wsData.language);
          if (!lang) return;

          let hasQuestion = true;
          lang.question = wsData.message;
          if (!wsData.approved) {
            lang.question = null;
            hasQuestion = !!languageOptions.find(l => l.question !== null);
          }

          this.setState({hasQuestion});
        }
      } catch (e) {
        console.error('Workshop onmessage parse error', e);
      }
    };

    const heOk = {
      "id": 90667,
      "message": "מהו הרווח שאנחנו מקבלים מהעסק ב\"אהבת חברים\"?",
      "user_name": "עורך",
      "type": "question",
      "language": "he",
      "approved": true
    };
    const enOk = {
      "id": 90667,
      "message": "Let's discuss how we can see each other as greater at times, lower, and equal to everyone?",
      "user_name": "עורך",
      "type": "question",
      "language": "en",
      "approved": true
    };
    const esOk = {
      "id": 90667,
      "message": "¿Cómo usamos adecuadamente el deseo de recibir que despierta en nosotros para hacernos avanzar en la conexión con la decena y adhesión al Creador?",
      "user_name": "עורך",
      "type": "question",
      "language": "es",
      "approved": true
    };
    const heNotOk = {
      "message": "מהו הרווח שאנחנו מקבלים מהעסק ב\"אהבת חברים\"?",
      "user_name": "עורך",
      "type": "question",
      "language": "he",
      "approved": false
    };
    const clearQ = {
      "questions": [{
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "en",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "he", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "ru",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "es", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "it",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "de", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "nl",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "fr", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "pt",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "tr", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "pl",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "ar", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "hu",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "fi", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "lt",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "ja", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "bg",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "ka", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "no",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "sv", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "hr",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "zh", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "fa",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "ro", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "hi",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "ua", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "mk",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "sl", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "lv",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "sk", "approved": false}, {
        "id": 0,
        "message": "",
        "user_name": "",
        "type": "",
        "language": "cs",
        "approved": false
      }, {"id": 0, "message": "", "user_name": "", "type": "", "language": "am", "approved": false}]
    };
    setTimeout(() => this.websocket.send(JSON.stringify(heOk)), 2000);
    setTimeout(() => this.websocket.send(JSON.stringify(enOk)), 3500);
    setTimeout(() => this.websocket.send(JSON.stringify(esOk)), 3000);
    // setTimeout(() => this.websocket.send(JSON.stringify(heNotOk)), 5000);
    // setTimeout(() => this.websocket.send(JSON.stringify(clearQ)), 5000);
    // setTimeout(() =>  this.setState({hasQuestion: true}), 2000);
  }

  componentWillUnmount() {
    this.websocket && this.websocket.close();
  }

  displayQuestion(show) {
    this.setState({showQuestion: show});
  }

  increaseFontSize() {
    this.state.disableDecreaseFontSize && this.setState({disableDecreaseFontSize: false});

    const {fontSize} = this.state;
    const nextFonSize = fontSize + 2;
    this.setState({fontSize: nextFonSize});
    localStorage.setItem(WS_FONT_SIZE, fontSize);

    if (nextFonSize > 48) {
      this.setState({disableIncreaseFontSize: true});
    }
  }

  decreaseFontSize() {
    this.state.disableIncreaseFontSize && this.setState({disableIncreaseFontSize: false});

    const {fontSize} = this.state;
    const nextFonSize = fontSize - 2;
    this.setState({fontSize: nextFonSize});
    localStorage.setItem(WS_FONT_SIZE, fontSize);

    if (nextFonSize < 18) {
      this.setState({disableDecreaseFontSize: true});
    }
  }

  changeLanguage({value}) {
    this.setState({selectedLanguageValue: value});
    localStorage.setItem(WS_LANG, value);
  }

  copyQuestion() {
    try {
      const el = document.createElement('input');
      el.setAttribute('value', this.state.question);
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
    const {
      fontSize,
      disableIncreaseFontSize,
      disableDecreaseFontSize,
      selectedLanguageValue,
      hasQuestion,
      showQuestion
    } = this.state;
    const {key, flag, text, question} = languageOptions[selectedLanguageValue];


    return (
      <div className="workshop-question-overlay">
        <Transition visible={hasQuestion && !showQuestion}>
          <div className="workshop-question-show-inner-overlay-btn">
            <Button size="large" title={t('workshop.showQuestion')} onClick={() => this.displayQuestion(true)}>
              <Icon name="file alternate outline"/>
            </Button>
          </div>
        </Transition>

        <Transition visible={hasQuestion && showQuestion}>
          <div className="workshop-question-inner-overlay">
            <div className="workshop__toolbar">
              <div className="workshop__toolbar__left">
                <Button compact title={t('workshop.hideQuestion')} onClick={() => this.displayQuestion(false)}>
                  <Icon name="eye slash"/>
                </Button>
              </div>
              <div className="workshop__toolbar__right">
                <input type="range" min="16" max="50" step="2"/>
                <Button compact
                        title={t('workshop.copyQuestion')}
                        onClick={this.copyQuestion}>
                  <Icon name="copy outline"/>
                </Button>
                <Button compact
                        className="font-size-increase"
                        title={t('workshop.increaseFontSize')}
                        onClick={this.increaseFontSize}
                        disabled={disableIncreaseFontSize}>
                  <Icon name="font"/>
                </Button>
                <Button compact
                        className="font-size-decrease"
                        title={t('workshop.decreaseFontSize')}
                        onClick={this.decreaseFontSize}
                        disabled={disableDecreaseFontSize}>
                  <Icon name="font"/>
                </Button>
                <Dropdown defaultValue={selectedLanguageValue}
                          selectOnBlur={false}
                          options={languageOptions}
                          onChange={(event, data) => this.changeLanguage(data)}
                          trigger={<span><Flag name={flag}/> {text}</span>}
                />
              </div>
            </div>
            <div className={classNames('workshop__question', {rtl: key === 'he'})}
                 style={{fontSize: `${fontSize}px`}}>
              <div className={classNames('lang-question', {'show-question': question})}>{question}</div>
              <div className={classNames('in-progress', {'show-question': !question})}>
                <div>{t('workshop.inProgress')}. {t('workshop.questionInOtherLanguages')}:</div>
                {languageOptions.filter(l => l.question !== null).map(l => (
                  <div className={classNames('other-question', {rtl: l.key === 'he'})}>{l.question}</div>
                ))}
              </div>
            </div>
          </div>
        </Transition>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);
