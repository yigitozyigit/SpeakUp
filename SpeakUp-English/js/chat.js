import { t } from './i18n/tr.js';

const messages = document.getElementById('chat-messages');
const scroll = document.getElementById('chat-scroll');

function scrollToEnd() {
  requestAnimationFrame(function () { scroll.scrollTop = scroll.scrollHeight; });
}

export function clearMessages() {
  while (messages.firstChild) messages.removeChild(messages.firstChild);
}

export function appendMessage(role, text, options = {}) {
  const article = document.createElement('article');
  article.className = 'message ' + (role === 'user' ? 'user' : 'ai') + (options.error ? ' error' : '');
  if (options.correct) article.classList.add('correct-flash');
  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = role === 'user' ? t('app.you') : t('app.teacher');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = String(text || '');
  article.append(author, bubble);

  if (role !== 'user' && options.speechText && 'speechSynthesis' in window) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const listen = document.createElement('button');
    listen.type = 'button';
    listen.className = 'listen-button';
    listen.textContent = '🔊 ' + t(options.speechKind === 'examples' ? 'app.listenExamples' : 'app.listen');
    listen.addEventListener('click', function () {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(options.speechText);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    });
    actions.append(listen);
    article.append(actions);
  }

  if (options.retry) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'listen-button';
    retry.textContent = t('app.retry');
    retry.addEventListener('click', options.retry);
    actions.append(retry);
    article.append(actions);
  }
  messages.append(article);
  scrollToEnd();
  return article;
}

export function setTyping(visible) {
  document.getElementById('typing-indicator').hidden = !visible;
  scrollToEnd();
}
