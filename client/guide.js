import {renderGuide} from '/client/guide-content.js';
export function guideHTML(state,language='zh-CN'){return renderGuide(state,language==='en');}
