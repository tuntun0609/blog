import { GitHubIcon } from '@/components/github-icon'
import { ArrowUpRightIcon } from '@/components/ui/arrow-up-right'
import { ProjectPreview } from './project-previews'
import { projects } from './projects-config'
import styles from './projects-showcase.module.css'

const ProjectTechnology = ({ name, path }: { name: string; path: string }) => (
  <li className={styles.technology} title={name}>
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
    <span className={styles.srOnly}>{name}</span>
  </li>
)

export function ProjectsShowcase() {
  return (
    <div className={styles.projectGrid} data-reveal>
      {projects.map((project) => (
        <article className={styles.projectCard} key={project.href}>
          <div className={styles.previewFrame}>
            <ProjectPreview project={project} />
          </div>

          <div className={styles.projectCopy}>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
          </div>

          <ul aria-label={`${project.title} 技术栈`} className={styles.stack}>
            {project.technologies.map((technology) => (
              <ProjectTechnology key={technology.name} {...technology} />
            ))}
          </ul>

          <div className={styles.projectFooter}>
            <a
              aria-label={`在 GitHub 查看 ${project.title}`}
              className={styles.githubLink}
              href={project.href}
              rel="noopener"
              target="_blank"
            >
              <GitHubIcon />
            </a>
            <a
              className={styles.detailsLink}
              href={project.href}
              rel="noopener"
              target="_blank"
            >
              查看项目
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
          </div>
        </article>
      ))}
    </div>
  )
}
