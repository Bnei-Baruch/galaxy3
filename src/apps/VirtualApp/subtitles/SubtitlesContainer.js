import React, {useEffect, useState} from "react";
import "./subtitles.scss";
import {messageManager, MSGS_NONE} from "./MessageManager";
import {SubtitlesView} from "./SubtitlesView";

export const WQ_LANG = "wq-language";
export const SUBTITLE_LANG = "subtitle-language";


export const SubtitlesContainer = ({playerLang, layout}) => {
  const [msgState, setMsgState] = useState({});
  const wqLang = localStorage.getItem(WQ_LANG) || playerLang;
  const subLang = localStorage.getItem(SUBTITLE_LANG) || playerLang;

  const handleOnMsg = (state) => setMsgState(state)

  useEffect(() => {
    messageManager.init(subLang, wqLang, handleOnMsg);
    return () => messageManager.exit();
  }, [subLang, wqLang]);

  let {msg: {message, isLtr, slide} = {}, language, wqLangs, display_status} = msgState;
	let fakeSlide = '';
	let fakeMsgState = {};

	// In process
	fakeMsgState = {
		msg: {
			slide: '',
			message: '',
			isLtr: false,
		},
		language: "he",
		wqLangs: ['en', 'es', 'he', 'ru'],
		display_status: "questions",
	}


	// Question
  fakeSlide = '<p>סיכום שיעור בעשיריות.</p>';
	fakeMsgState = {
		msg: {
			slide: '', // fakeSlide,
			message: '', // fakeSlide,
			isLtr: false,
		},
		language: "he",
		wqLangs: ['en', 'es', 'he', 'ru'],
		display_status: "questions",
	}

	// Link - Have not checked yet.
	fakeSlide = '<a href="kuku">this is a link</a>';
	fakeMsgState = {
		msg: {
			slide: fakeSlide,
			message: fakeSlide,
			isLtr: false,
		},
		language: "he",
		wqLangs: [],
		display_status: "subtitles",
	}

	// Subtitle
	fakeSlide = "<p>2. על כל דבר שמקבלים צריכים להקדים תפלה, שיהיה כלי לקבל את ההשפעה, יוצא, שאפילו לאחר מה שהקדוש ברוך הוא הבטיחו במראה הסולם, זה נקרא אור מקיף.</p><p>אבל בזמן שפגש את עשו, שאז הוצרך לישועה בהוה,</p>";
	fakeMsgState = {
		msg: {
			slide: fakeSlide,
			message: fakeSlide,
			isLtr: false,
		},
		language: "he",
		wqLangs: ['en', 'es', 'he', 'ru'],
		display_status: "subtitles",
	}


	// wqLangs = [];
  // Hebrew subtitle
	/*display_status = "subtitles";
	slide = "";
  isLtr = false;
	// Hebrew question
	display_status = "questions";
	slide = "<p>תסכמו את השיעור בעשיריות. תסכמו את השיעור בעשיריות. תסכמו את השיעור בעשיריות. תסכמו את השיעור בעשיריות.</p>";
  isLtr = false;
  // English subtitle
	display_status = "subtitles";
	slide = '<p>5) The number thirteen: the thirteen qualities of mercy or upper KHB HGT, and lower HGT and NHYM.</p>' +
		'<p>We must understand: It is said in <em>Sefer</em> <em>Yetzira</em> [<em>The Book of Creation</em>], “Ten and not nine; ten and not eleven.” Thus,</p>';
	// English question
	display_status = "questions";
	slide = '<p>Summarize the lesson in the ten. Summarize the lesson in the ten. Summarize the lesson in the ten. Summarize the lesson in the ten.</p>';
	isLtr = true;
	message = slide;
	*/


  if (!msgState || msgState.display_status === MSGS_NONE.display_status)
    return null;

  return <SubtitlesView msgState={msgState}/>
  // return <SubtitlesView msgState={fakeMsgState}/>
};
