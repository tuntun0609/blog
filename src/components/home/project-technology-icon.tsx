import type { ReactElement } from 'react'
import {
  siAgentskills,
  siNextdotjs,
  siReact,
  siTailwindcss,
} from 'simple-icons'

export type ProjectTechnologyIconName =
  | 'agent-skills'
  | 'chrome-web-store'
  | 'javascript'
  | 'mdx'
  | 'nextjs'
  | 'python'
  | 'react'
  | 'tailwindcss'
  | 'typescript'

interface SimpleIconProps {
  color: string
  path: string
}

const SimpleIcon = ({ color, path }: SimpleIconProps) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d={path} fill={color} />
  </svg>
)

const AgentSkillsIcon = () => (
  <SimpleIcon color="#111111" path={siAgentskills.path} />
)

const ChromeWebStoreIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 256 223">
    <defs>
      <linearGradient
        id="project-chrome-red"
        x1="0%"
        x2="100%"
        y1="50%"
        y2="50%"
      >
        <stop offset="0%" stopColor="#d93025" />
        <stop offset="100%" stopColor="#ea4335" />
      </linearGradient>
      <linearGradient
        id="project-chrome-green"
        x1="74.943%"
        x2="19.813%"
        y1="95.826%"
        y2="-4.161%"
      >
        <stop offset="0%" stopColor="#1e8e3e" />
        <stop offset="100%" stopColor="#34a853" />
      </linearGradient>
      <linearGradient
        id="project-chrome-yellow"
        x1="59.898%"
        x2="21.416%"
        y1="-.134%"
        y2="99.86%"
      >
        <stop offset="0%" stopColor="#fbbc04" />
        <stop offset="100%" stopColor="#fcc934" />
      </linearGradient>
      <path
        d="M255.983 0H0v204.837c0 9.633 7.814 17.464 17.464 17.464h221.072c9.633 0 17.464-7.814 17.464-17.464z"
        id="project-chrome-store-shape"
      />
      <mask fill="#fff" id="project-chrome-store-mask">
        <use href="#project-chrome-store-shape" />
      </mask>
    </defs>
    <path
      d="M255.983 0H0v204.837c0 9.633 7.814 17.464 17.464 17.464h221.072c9.633 0 17.464-7.814 17.464-17.464z"
      fill="#f1f3f4"
    />
    <path d="M0 0h255.983v111.74H0z" fill="#e8eaed" />
    <path
      d="M157.076 47.727H98.907A11.63 11.63 0 0 1 87.27 36.09a11.63 11.63 0 0 1 11.637-11.637h58.169a11.63 11.63 0 0 1 11.637 11.637c0 6.417-5.204 11.637-11.637 11.637"
      fill="#fff"
    />
    <g mask="url(#project-chrome-store-mask)">
      <g transform="translate(17.455 94.293)">
        <path
          d="m14.812 55.255 15.241 46.498 32.638 36.427 47.845-82.908 95.724-.017C187.146 22.213 151.443 0 110.536 0S33.926 22.213 14.812 55.255"
          fill="url(#project-chrome-red)"
        />
        <path
          d="m110.52 221.105 32.637-36.443 15.224-46.482H62.674L14.812 55.255c-19.047 33.076-20.445 75.128.017 110.561 20.445 35.434 57.545 55.256 95.69 55.29"
          fill="url(#project-chrome-green)"
        />
        <path
          d="M206.26 55.272h-95.724l47.862 82.908-47.862 82.925c38.162-.033 75.263-19.855 95.708-55.289 20.461-35.433 19.064-77.468.016-110.544"
          fill="url(#project-chrome-yellow)"
        />
        <ellipse
          cx="110.536"
          cy="110.544"
          fill="#f1f3f4"
          rx="55.255"
          ry="55.272"
        />
        <ellipse
          cx="110.536"
          cy="110.544"
          fill="#1a73e8"
          rx="44.898"
          ry="44.915"
        />
      </g>
    </g>
  </svg>
)

const JavaScriptIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 256 256">
    <path d="M0 0h256v256H0z" fill="#f7df1e" />
    <path d="m67.312 213.932 19.59-11.856c3.78 6.701 7.218 12.371 15.465 12.371 7.905 0 12.89-3.092 12.89-15.12v-81.798h24.057v82.138c0 24.917-14.606 36.259-35.916 36.259-19.245 0-30.416-9.967-36.087-21.996m85.07-2.576 19.588-11.341c5.157 8.421 11.859 14.607 23.715 14.607 9.969 0 16.325-4.984 16.325-11.858 0-8.248-6.53-11.17-17.528-15.98l-6.013-2.58c-17.357-7.387-28.87-16.667-28.87-36.257 0-18.044 13.747-31.792 35.228-31.792 15.294 0 26.292 5.328 34.196 19.247l-18.732 12.03c-4.125-7.389-8.591-10.31-15.465-10.31-7.046 0-11.514 4.468-11.514 10.31 0 7.217 4.468 10.14 14.778 14.608l6.014 2.577c20.45 8.765 31.963 17.7 31.963 37.804 0 21.654-17.012 33.51-39.867 33.51-22.339 0-36.774-10.654-43.819-24.574" />
  </svg>
)

const MdxIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 512 212">
    <path d="m272.696 40.203-.002 84.896 31.185-31.178 15.74 15.741-57.642 57.638-58.369-58.369 15.741-15.741 31.085 31.085.001-84.072zM72.162 162.979V97.232l40.255 40.257 40.56-40.557v65.383h22.261V43.192l-62.82 62.816-62.517-62.521v119.492z" />
    <path
      d="m447.847 36.651 15.74 15.741-47.149 47.147 45.699 45.701-15.741 15.741-45.7-45.699-45.701 45.699-15.74-15.741 45.695-45.701-47.146-47.147 15.74-15.741 47.152 47.146z"
      fill="#f9ac00"
    />
  </svg>
)

const NextIcon = () => <SimpleIcon color="#111111" path={siNextdotjs.path} />

const PythonIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 256 255">
    <defs>
      <linearGradient
        id="project-python-blue"
        x1="12.959%"
        x2="79.639%"
        y1="12.039%"
        y2="78.201%"
      >
        <stop offset="0%" stopColor="#387eb8" />
        <stop offset="100%" stopColor="#366994" />
      </linearGradient>
      <linearGradient
        id="project-python-yellow"
        x1="19.128%"
        x2="90.742%"
        y1="20.579%"
        y2="88.429%"
      >
        <stop offset="0%" stopColor="#ffe052" />
        <stop offset="100%" stopColor="#ffc331" />
      </linearGradient>
    </defs>
    <path
      d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475.557 34.475-33.319V33.97S194.67.072 126.916.072M92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13"
      fill="url(#project-python-blue)"
    />
    <path
      d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.712c0-65.416-36.21-63.096-36.21-63.096h-21.61v30.355s1.165 36.21-35.632 36.21h-61.362s-34.475-.557-34.475 33.32v56.013s-5.235 33.897 62.518 33.897m34.114-19.586a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.131 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13"
      fill="url(#project-python-yellow)"
    />
  </svg>
)

const ReactIcon = () => <SimpleIcon color="#61dafb" path={siReact.path} />

const TailwindIcon = () => (
  <SimpleIcon color="#06b6d4" path={siTailwindcss.path} />
)

const TypeScriptIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 256 256">
    <path
      d="M20 0h216c11.046 0 20 8.954 20 20v216c0 11.046-8.954 20-20 20H20c-11.046 0-20-8.954-20-20V20C0 8.954 8.954 0 20 0"
      fill="#3178c6"
    />
    <path
      d="M150.518 200.475v27.62q6.738 3.453 15.938 5.179T185.849 235q9.934 0 18.874-1.899t15.678-6.257q6.738-4.359 10.669-11.394 3.93-7.033 3.93-17.391 0-7.51-2.246-13.163a30.8 30.8 0 0 0-6.479-10.055q-4.232-4.402-10.149-7.898t-13.347-6.602q-5.442-2.245-9.761-4.359t-7.342-4.316q-3.024-2.2-4.665-4.661t-1.641-5.567q0-2.848 1.468-5.135 1.469-2.288 4.147-3.927t6.565-2.547q3.887-.906 8.638-.906 3.456 0 7.299.518 3.844.517 7.732 1.597a54 54 0 0 1 7.558 2.719 41.7 41.7 0 0 1 6.781 3.797v-25.807q-6.306-2.417-13.778-3.582T198.633 107q-9.847 0-18.658 2.115-8.811 2.114-15.506 6.602-6.694 4.49-10.582 11.437Q150 134.102 150 143.769q0 12.342 7.127 21.06t21.638 14.759a292 292 0 0 1 10.625 4.575q4.924 2.244 8.509 4.66t5.658 5.265 2.073 6.474a9.9 9.9 0 0 1-1.296 4.963q-1.295 2.287-3.93 3.97t-6.565 2.632-9.2.95q-8.983 0-17.794-3.151t-16.327-9.451m-46.036-68.733H140V109H41v22.742h35.345V233h28.137z"
      fill="#fff"
    />
  </svg>
)

type TechnologyIconComponent = () => ReactElement

const TECHNOLOGY_ICONS: Record<
  ProjectTechnologyIconName,
  TechnologyIconComponent
> = {
  'agent-skills': AgentSkillsIcon,
  'chrome-web-store': ChromeWebStoreIcon,
  javascript: JavaScriptIcon,
  mdx: MdxIcon,
  nextjs: NextIcon,
  python: PythonIcon,
  react: ReactIcon,
  tailwindcss: TailwindIcon,
  typescript: TypeScriptIcon,
}

export const ProjectTechnologyIcon = ({
  name,
}: {
  name: ProjectTechnologyIconName
}) => {
  const Icon = TECHNOLOGY_ICONS[name]

  return <Icon />
}
