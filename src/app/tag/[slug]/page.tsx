import tags from '@/tags.json'

export const generateStaticParams = async () => tags.map(tag => ({ slug: tag.tag }))

const TagPage = ({ params }: { params: { slug: string } }) => <div>{params.slug}</div>

export default TagPage
