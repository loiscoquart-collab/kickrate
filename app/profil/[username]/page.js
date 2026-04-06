'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'

export default function ProfilPage() {
  const { username } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [sort, setSort] = useState('recent')

  useEffect(() => {
    fetchProfile()
  }, [username])

  async function fetchProfile() {
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()
    setProfile(p)
    if (p) {
      const { data: r } = await supabase
        .from('ratings')
        .select('*')
        .eq('user_id', p.id)
      setRatings(r || [])
    }
  }

  function getSorted() {
    const r = [...ratings]
    if (sort === 'recent') return r.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'ancien') return r.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'meilleures') return r.sort((a,b) => b.stars - a.stars)
    if (sort === 'mauvaises') return r.sort((a,b) => a.stars - b.stars)
    return r
  }

  if (!profile) return <div style={{padding:'2rem',color:'#aaa'}}>Chargement...</div>

  return (
    <div style={{maxWidth:440,margin:'0 auto',padding:'1rem'}}>
      <button onClick={()=>router.back()} style={{fontSize:13,color:'#888',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',marginBottom:16,padding:0}}>← Retour</button>

      <div style={{border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:50,height:50,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,color:'#185FA5'}}>{profile.avatar_initials}</div>
        <div>
          <div style={{fontWeight:500}}>@{profile.username}</div>
          <div style={{fontSize:13,color:'#aaa'}}>{ratings.length} match{ratings.length > 1 ? 's' : ''} noté{ratings.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:16}}>
        <div style={{background:'#f9f9f9',borderRadius:8,padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:500}}>{ratings.length}</div>
          <div style={{fontSize:11,color:'#aaa'}}>Matchs notés</div>
        </div>
        <div style={{background:'#f9f9f9',borderRadius:8,padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:500}}>
            {ratings.length ? (ratings.reduce((a,r)=>a+r.stars,0)/ratings.length).toFixed(1) : '-'}
          </div>
          <div style={{fontSize:11,color:'#aaa'}}>Note moyenne</div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {['recent','ancien','meilleures','mauvaises'].map(s => (
          <button key={s} onClick={