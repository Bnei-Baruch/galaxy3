import React, {Component} from 'react';
import './VirtualWorkshopQuestion.scss'
import {withTranslation} from 'react-i18next';
import Dropdown from 'semantic-ui-react/dist/commonjs/modules/Dropdown';
import Flag from 'semantic-ui-react/dist/commonjs/elements/Flag';
import Button from 'semantic-ui-react/dist/commonjs/elements/Button';
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon';


const languageOptions = [
  {key: 'il', value: 'il', flag: 'il', text: 'עברית', content: 'עברית'},
  {key: 'ru', value: 'ru', flag: 'ru', text: 'Русский', content: 'Русский'}
];

class VirtualWorkshopQuestion extends Component {
  constructor(props) {
    super(props);

    this.state = {
      disableIncreaseFontSize: false,
      disableDecreaseFontSize: false,
      selectedLanguage: languageOptions[0],
      fontSize: 18,
      innerOverlayAnimation: null,
      showInnerOverlayAnimation: null
    };

    this.displayQuestion = this.displayQuestion.bind(this);
    this.decreaseFontSize = this.decreaseFontSize.bind(this);
    this.increaseFontSize = this.increaseFontSize.bind(this);
    this.changeLanguage = this.changeLanguage.bind(this);

    // const ws = new WebSocket('wss://ktuviot.kbb1.com:4000/congress');
    // ws.onerror = function(event) {
    //   console.error("WebSocket error observed:", event);
    // };
  }

  displayQuestion(show) {
    const showAnimationClass = ' animate__animated slideInLeftCustom';
    const hideAnimationClass = ' animate__animated animate__slideOutLeft';
    let innerOverlay = hideAnimationClass;
    let showInnerOverlay = showAnimationClass;

    if (show) {
      innerOverlay = showAnimationClass;
      showInnerOverlay = hideAnimationClass;
    }

    this.setState({innerOverlayAnimation: innerOverlay, showInnerOverlayAnimation: showInnerOverlay});
  }

  increaseFontSize() {
    this.state.disableDecreaseFontSize && this.setState({disableDecreaseFontSize: false});

    const {fontSize} = this.state;
    const nextFonSize = fontSize + 2;
    this.setState({fontSize: nextFonSize});

    if (nextFonSize > 48) {
      this.setState({disableIncreaseFontSize: true});
    }
  }

  decreaseFontSize() {
    this.state.disableIncreaseFontSize && this.setState({disableIncreaseFontSize: false});

    const {fontSize} = this.state;
    const nextFonSize = fontSize - 2;
    this.setState({fontSize: nextFonSize});

    if (nextFonSize < 18) {
      this.setState({disableDecreaseFontSize: true});
    }
  }

  changeLanguage({value}) {
    const language = languageOptions.find((lang) => lang.value === value);
    this.setState({selectedLanguage: language});
  }

  render() {
    const {t} = this.props;
    const {disableIncreaseFontSize, disableDecreaseFontSize, selectedLanguage, fontSize, innerOverlayAnimation, showInnerOverlayAnimation} = this.state;

    let questionContainerClass = 'workshop-question-inner-overlay';
    let showQuestionContainerClass = 'workshop-question-show-inner-overlay';

    if (innerOverlayAnimation && showInnerOverlayAnimation) {
      questionContainerClass += innerOverlayAnimation;
      showQuestionContainerClass += showInnerOverlayAnimation;
    }

    const languages = (
      <Dropdown selection
                selectOnBlur={false}
                options={languageOptions}
                onChange={(event, data) => this.changeLanguage(data)}
                trigger={<span><Flag name={selectedLanguage.flag}/> {selectedLanguage.text}</span>}
      />
    );

    return (
      <div className="workshop-question-overlay">
        <div className={questionContainerClass}>
          <div className="workshop__toolbar">
            <div className="workshop__toolbar__left">
              <Button compact title={t('oldClient.hideQuestion')} onClick={() => this.displayQuestion(false)}>
                <Icon name='arrow alternate circle left outline'/>
              </Button>
            </div>
            <div className="workshop__toolbar__right">
              <Button compact
                      className="font-size-increase"
                      title={t('oldClient.increaseFontSize')}
                      onClick={this.increaseFontSize}
                      disabled={disableIncreaseFontSize}>
                <Icon name="font"/>
              </Button>
              <Button compact
                      className="font-size-decrease"
                      title={t('oldClient.decreaseFontSize')}
                      onClick={this.decreaseFontSize}
                      disabled={disableDecreaseFontSize}>
                <Icon name="font"/>
              </Button>
              {languages}
            </div>
          </div>
          <div className="workshop__question" style={{'font-size': `${fontSize}px`}}>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab accusantium adipisci aliquam dolorem eligendi
            libero quam quas quis recusandae, repellat reprehenderit tempore ullam, vel! Deleniti dicta est excepturi
            magnam molestiae nihil odio praesentium sequi ut vitae. Ducimus et illum inventore nemo obcaecati quam
            quidem recusandae! Eos esse facere maxime nulla.
          </div>
        </div>
        <div className={showQuestionContainerClass}>
          <Button compact title={t('oldClient.showQuestion')} onClick={() => this.displayQuestion(true)}>
            <Icon name='file alternate outline'/>
          </Button>
        </div>
      </div>
    );
  }
}

export default withTranslation()(VirtualWorkshopQuestion);



