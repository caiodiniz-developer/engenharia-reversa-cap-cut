import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { splitWords, staggerDelay } from './split';

/** Mostra o texto palavra por palavra, cada uma subindo de uma "máscara". As palavras continuam texto normal para leitores de tela. */
export function SplitText({ text, delay = 0, wordClassName = '' }: { text: string; delay?: number; wordClassName?: string }) {
  const reduce = useReducedMotion();
  const words = splitWords(text);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="inline-block overflow-hidden pb-[0.14em] align-bottom [margin-bottom:-0.14em]">
            <motion.span
              className={'inline-block ' + wordClassName}
              {...(reduce ? {} : { initial: { y: '110%', opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { duration: 0.6, delay: delay + staggerDelay(i), ease: [0.22, 1, 0.36, 1] as const } })}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </>
  );
}
