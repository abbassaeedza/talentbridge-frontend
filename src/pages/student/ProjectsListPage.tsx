import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectApi } from '../../api/services'
import { Search, Clock, Users, SlidersHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

export default function ProjectsListPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', query, sortBy, page],
    queryFn: () => projectApi.getOpen({ search: query || undefined, sortBy, page, size: 12 }).then(r => r.data)
  })

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setQuery(search); setPage(0) }

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Browse Projects</h1>
        <p className="page-subtitle">{data?.totalElements ?? '…'} open projects available</p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, description, tools…"
          />
        </form>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-ink-400" />
          <select className="input w-auto" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="createdAt">Latest</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-ink-700 rounded mb-3 w-3/4" />
              <div className="h-3 bg-ink-800 rounded mb-2" />
              <div className="h-3 bg-ink-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.content.map(p => (
              <Link key={p.id} to={`/student/projects/${p.id}`}
                className="card p-5 hover:border-ember-500/30 hover:bg-ink-800/20 transition-all duration-200 group flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-display font-bold text-ink-200 flex-shrink-0">
                    {p.companyName[0]}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="badge badge-open text-[10px]">OPEN</span>
                    {p.companyIndustry && (
                      <span className="badge bg-ink-700/50 text-ink-400 border-ink-600/30 text-[10px]">{p.companyIndustry}</span>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-white text-sm mb-2 group-hover:text-ember-300 transition-colors line-clamp-2">
                  {p.title}
                </h3>
                <p className="text-xs text-ink-400 mb-3 line-clamp-3 flex-1">{p.description}</p>

                {p.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.tools.slice(0, 4).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-ink-700/60 text-ink-400 text-[10px] font-mono">{t}</span>
                    ))}
                    {p.tools.length > 4 && <span className="text-[10px] text-ink-500">+{p.tools.length - 4}</span>}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-ink-500 pt-3 border-t border-ink-800/50">
                  <span className="font-medium text-ink-400">{p.companyName}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {p.applicantCount}
                    </span>
                    {p.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(p.deadline), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button onClick={() => setPage(p => p - 1)} disabled={data.first} className="btn-secondary px-4 py-2 text-xs">Previous</button>
              <span className="px-4 py-2 text-xs text-ink-400">Page {page + 1} of {data.totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={data.last} className="btn-secondary px-4 py-2 text-xs">Next</button>
            </div>
          )}

          {data?.content.length === 0 && (
            <div className="text-center py-20">
              <p className="text-ink-400 text-sm">No projects found. Try adjusting your search.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
