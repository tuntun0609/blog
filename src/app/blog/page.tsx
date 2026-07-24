import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPagination } from "@/components/blog/blog-pagination";
import { PostCard } from "@/components/blog/post-card";
import { getPublishedPosts, POSTS_PER_PAGE } from "@/lib/blog";

export const metadata: Metadata = {
  title: "博客",
  description: "来自开发札记的工程实践、技术观察与产品思考。",
};

type BlogPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const posts = getPublishedPosts();
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const { page } = await searchParams;
  const pageValue = Array.isArray(page) ? page[0] : page;
  const currentPage = pageValue === undefined ? 1 : Number(pageValue);

  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1 ||
    currentPage > totalPages
  ) {
    notFound();
  }

  const start = (currentPage - 1) * POSTS_PER_PAGE;
  const visiblePosts = posts.slice(start, start + POSTS_PER_PAGE);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">博客</h1>
        <p className="text-base leading-7 text-muted-foreground sm:text-lg">
          工程实践、技术观察，以及把产品做好的具体方法。
        </p>
      </header>

      <section
        aria-label="文章列表"
        className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {visiblePosts.map((post, index) => (
          <PostCard key={post.url} post={post} preload={index === 0} />
        ))}
      </section>

      {totalPages > 1 ? (
        <BlogPagination currentPage={currentPage} totalPages={totalPages} />
      ) : null}
    </div>
  );
}
