import { GoogleAnalytics } from '@next/third-parties/google'
import Script from 'next/script'

export const Analytics = () =>
  process.env.NODE_ENV === 'production' && (
    <>
      <Script
        id="show-banner"
        dangerouslySetInnerHTML={{
          __html: `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    		})(window, document, "clarity", "script", "ntwpfsm14w");`,
        }}
      />
      <GoogleAnalytics gaId="G-Y9CY3CQWFD" />
    </>
  )
