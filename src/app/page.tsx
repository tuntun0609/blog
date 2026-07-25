import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MailIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomeMotion } from "@/components/home/home-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatPostDate, getPublishedPosts } from "@/lib/blog";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "王望 — 产品工程师与写作者",
  description: "王望的个人主页，记录产品工程、内容系统与持续构建的过程。",
};

const featuredWork = [
  {
    number: "01",
    label: "CONTENT SYSTEM",
    title: "内容基础设施",
    description:
      "把 Markdown、类型校验和 App Router 组织成一条清晰、稳定的内容发布链路。",
    image: "/blog/content-architecture.jpg",
    href: "/blog/nextjs-16-content-architecture",
    accent: "orange",
  },
  {
    number: "02",
    label: "PERFORMANCE",
    title: "快速的阅读体验",
    description: "从页面结构、图片策略到服务端分页，让速度成为设计的一部分。",
    image: "/blog/fast-blog.jpg",
    href: "/blog/designing-fast-blog-pages",
    accent: "cyan",
  },
  {
    number: "03",
    label: "DESIGN SYSTEM",
    title: "可持续的组件组合",
    description:
      "保留组件系统的升级路径，同时让产品拥有自己的节奏、层级与辨识度。",
    image: "/blog/shadcn-composition.jpg",
    href: "/blog/shadcn-composition",
    accent: "lime",
  },
] as const;

const principles = [
  {
    index: "01",
    title: "先找到真正的问题",
    description: "从使用场景和约束出发，而不是从功能清单出发。",
  },
  {
    index: "02",
    title: "让复杂留在系统里",
    description: "界面应该安静、明确，让人不需要反复确认下一步。",
  },
  {
    index: "03",
    title: "写下来，再做一遍",
    description: "通过记录沉淀判断，让一次解决方案变成长期能力。",
  },
] as const;

export default function HomePage() {
  const recentPosts = getPublishedPosts().slice(0, 3);

  return (
    <div id="personal-home" className={styles.page}>
      <HomeMotion rootId="personal-home" />

      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.logo} href="/" aria-label="王望的个人主页">
            <span>WW</span>
            <span className={styles.logoText}>王望</span>
          </Link>

          <nav className={styles.nav} aria-label="主导航">
            <a href="#work">作品</a>
            <a href="#about">关于</a>
            <Link href="/blog">文章</Link>
            <ThemeToggle />
            <a className={styles.navContact} href="#contact">
              联系
              <ArrowDownRightIcon aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow} data-reveal>
              <span className={styles.statusDot} />
              PRODUCT ENGINEER · SHANGHAI
            </p>

            <h1
              id="hero-title"
              className={styles.heroTitle}
              data-reveal
              data-delay="1"
            >
              <span>王望</span>
              <small>WANG WANG</small>
            </h1>

            <p className={styles.heroLead} data-reveal data-delay="2">
              我设计并构建数字产品，关注内容系统、界面体验，
              以及那些让复杂事物变得清楚的细节。
            </p>

            <div className={styles.heroActions} data-reveal data-delay="3">
              <a className={styles.primaryAction} href="#work">
                看近期作品
                <ArrowDownRightIcon aria-hidden="true" />
              </a>
              <a className={styles.textAction} href="mailto:hello@wangwang.dev">
                写封邮件
                <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </div>

            <div className={styles.heroMeta} data-reveal data-delay="3">
              <span>当前关注</span>
              <p>设计系统 · 内容工程 · AI 产品</p>
            </div>
          </div>

          <figure className={styles.heroVisual} data-reveal data-delay="2">
            <div
              className={styles.heroImageParallax}
              data-parallax
              data-parallax-speed="0.055"
            >
              <Image
                src="/blog/content-architecture.jpg"
                alt="放着代码编辑器的个人工作台"
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 820px) 100vw, 46vw"
                className={styles.heroImage}
              />
            </div>
            <span className={styles.visualIndex}>DESK / 01</span>
            <figcaption className={styles.visualCaption}>
              <span>正在构建</span>
              <strong>更安静、更可靠的软件。</strong>
            </figcaption>
          </figure>
        </section>

        <section className={styles.introBand} aria-label="个人简介">
          <div className={styles.introBandInner} data-reveal>
            <p>BUILD</p>
            <span>把模糊的问题做成清晰的产品</span>
            <p>WRITE</p>
            <span>把解决过程写成可以复用的知识</span>
          </div>
        </section>

        <section
          id="work"
          className={styles.workSection}
          aria-labelledby="work-title"
        >
          <header className={styles.sectionHeader} data-reveal>
            <div>
              <p className={styles.sectionKicker}>SELECTED WORK / 2026</p>
              <h2 id="work-title">近期实践</h2>
            </div>
            <p>
              我喜欢从结构开始工作：先理解信息和行为，再让视觉、代码与内容形成同一个系统。
            </p>
          </header>

          <div className={styles.workList}>
            {featuredWork.map((work, index) => (
              <article
                className={styles.workItem}
                data-accent={work.accent}
                data-reveal
                key={work.number}
              >
                <Link href={work.href} className={styles.workImageLink}>
                  <div
                    className={styles.workImageParallax}
                    data-parallax
                    data-parallax-speed={index % 2 === 0 ? "0.035" : "0.05"}
                  >
                    <Image
                      src={work.image}
                      alt=""
                      fill
                      sizes="(max-width: 820px) 100vw, 56vw"
                      className={styles.workImage}
                    />
                  </div>
                  <span className={styles.workNumber}>{work.number}</span>
                </Link>

                <div className={styles.workContent}>
                  <p>{work.label}</p>
                  <h3>{work.title}</h3>
                  <p className={styles.workDescription}>{work.description}</p>
                  <Link className={styles.workLink} href={work.href}>
                    阅读项目笔记
                    <ArrowUpRightIcon aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="about"
          className={styles.aboutSection}
          aria-labelledby="about-title"
        >
          <div className={styles.aboutInner}>
            <div className={styles.aboutSticky} data-reveal>
              <p className={styles.sectionKicker}>HOW I WORK</p>
              <h2 id="about-title">做事的方法，决定作品的质感。</h2>
              <p>
                我在设计与工程之间工作。关心的不只是界面能否完成任务，也关心团队以后能否继续把它做好。
              </p>
            </div>

            <ol className={styles.principleList}>
              {principles.map((principle) => (
                <li key={principle.index} data-reveal>
                  <span>{principle.index}</span>
                  <div>
                    <h3>{principle.title}</h3>
                    <p>{principle.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.notesSection} aria-labelledby="notes-title">
          <header className={styles.notesHeader} data-reveal>
            <div>
              <p className={styles.sectionKicker}>FIELD NOTES</p>
              <h2 id="notes-title">最近在写</h2>
            </div>
            <Link href="/blog" className={styles.allNotesLink}>
              全部文章
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </header>

          <div className={styles.noteList}>
            {recentPosts.map((post, index) => (
              <Link
                href={post.url}
                className={styles.noteItem}
                data-reveal
                key={post.url}
              >
                <span className={styles.noteIndex}>0{index + 1}</span>
                <div>
                  <p>{post.data.category}</p>
                  <h3>{post.data.title ?? "未命名文章"}</h3>
                </div>
                <time dateTime={post.data.date}>
                  {formatPostDate(post.data.date)}
                </time>
                <ArrowUpRightIcon aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section
          id="contact"
          className={styles.contactSection}
          aria-labelledby="contact-title"
        >
          <div className={styles.contactInner} data-reveal>
            <p className={styles.sectionKicker}>
              LET&apos;S MAKE SOMETHING CLEAR
            </p>
            <h2 id="contact-title">有一个值得认真做的问题？</h2>
            <a href="mailto:hello@wangwang.dev" className={styles.contactLink}>
              <MailIcon aria-hidden="true" />
              hello@wangwang.dev
              <ArrowUpRightIcon aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>王望 · 产品工程师 / 写作者</p>
        <p>上海 · 2026</p>
        <a href="#main-content">回到顶部 ↑</a>
      </footer>
    </div>
  );
}
