import Api from '../../../../shared/Api';

export const sendQuestion = (data) => {
  const options = Api.makeOptions('POST', data);
  return Api.logAndParse(`send question`, fetch(`https://qst.kli.one/api/ask`, options));
};
export const getQuestions = (data) => {
  const options = Api.makeOptions('POST', data);
  return Api.logAndParse(`get questions`, fetch(`https://qst.kli.one/api/feed`, options));
};
