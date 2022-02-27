import Api from "../../../../shared/Api";
import {QST_BACKEND} from "../../../../shared/env";

export const sendQuestion = (data) => {
  const options = Api.makeOptions("POST", data);
  return Api.logAndParse(`send question`, fetch(`${QST_BACKEND}/ask`, options));
};
export const getQuestions = (data) => {
  const options = Api.makeOptions("POST", data);
  return Api.logAndParse(`get questions`, fetch(`${QST_BACKEND}/feed`, options));
};
