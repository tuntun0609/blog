import tags from '@/tags.json'

const TagList = () => (
  <div>
    <h1>标签</h1>
    <ul>
      {tags.map(tag => (
        <li key={tag.tag}>
          {tag.tag} ({tag.count})
        </li>
      ))}
    </ul>
  </div>
)

export default TagList
