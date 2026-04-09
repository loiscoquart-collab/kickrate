'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const Overlay = ({ children, onClose }) => (
  <div
    style={{position:'fixed',inset:0,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}
    onMouseDown={e=>e.target===e.currentTarget&&onClose()}
  >
    {children}
  </div>
)

const SortBar = ({ value, onChange }) => (
  <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
    {['recent','ancien','meilleures','mauvaises'].map(s => (
      <button key={s} onClick={()=>onChange(s)} style={{padding:'4px 12px',fontSize:12,border:'0.5px solid #ddd',borderRadius:20,background:value===s?'#000':'transparent',color:value===s?'#fff':'#666',cursor:'pointer',fontFamily:'inherit'}}>
        {s==='recent'?'Récent':s==='ancien'?'Ancien':s==='meilleures'?'Meilleures':'Mauvaises'}
      </button>
    ))}
  </div>
)

const RatingCard = ({ r, showDelete, onOpenRating, likes, comments, user, friendIds, expandedComments, onToggleLike, onToggleComments, onOpenComment, onReply, onDelete, timeAgo, router }) => {
  const ratingComments = comments.filter(c => c.rating_id === r.id && !c.parent_id)
  const getReplies = (commentId) => comments.filter(c => c.parent_id === commentId)
  const likeCount = likes.filter(l => l.rating_id === r.id).length
  const liked = likes.some(l => l.rating_id === r.id && l.user_id === user?.id)
  const expanded = expandedComments[r.id]

  return (
    <div style={{border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:10,background:'var(--background)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div onClick={()=>router.push(`/profil/${r.profiles?.username}`)} style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#185FA5',cursor:'pointer',flexShrink:0}}>{r.profiles?.avatar_initials}</div>
        <div style={{flex:1}}>
          <div onClick={()=>router.push(`/profil/${r.profiles?.username}`)} style={{fontSize:13,fontWeight:500,cursor:'pointer'}}>@{r.profiles?.username}</div>
          <div style={{fontSize:11,color:'#aaa'}}>{timeAgo(r.created_at)}</div>
        </div>
        <span style={{color:'#EF9F27',fontSize:14}}>{'★'.repeat(r.stars)}{'☆'.repeat(5-r.stars)}</span>
      </div>
      <div style={{background:'#f0f0f0',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={{fontSize:13,fontWeight:500,color:'#222'}}>{r.match_teams}</span>
          <span style={{fontSize:13,color:'#444'}}>{r.match_score}</span>
        </div>
      </div>
      {r.comment && <p style={{fontSize:13,color:'#333',lineHeight:1.5,marginBottom:8}}>{r.comment}</p>}
      {expanded && ratingComments.map(c => (
        <div key={c.id} style={{marginBottom:6,paddingLeft:8,borderLeft:'2px solid #ddd'}}>
          <span style={{fontSize:12,fontWeight:500,color:'#333'}}>@{c.profiles?.username} </span>
          <span style={{fontSize:12,color:'#444'}}>{c.content}</span>
          <div>
            <button onMouseDown={()=>onReply(r, c)} style={{fontSize:11,color:'#888',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>Répondre</button>
          </div>
          {getReplies(c.id).map(reply => (
            <div key={reply.id} style={{marginTop:4,paddingLeft:8,borderLeft:'2px solid #eee'}}>
              <span style={{fontSize:12,fontWeight:500,color:'#333'}}>@{reply.profiles?.username} </span>
              <span style={{fontSize:12,color:'#444'}}>{reply.content}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8,paddingTop:8,borderTop:'0.5px solid #eee',flexWrap:'wrap'}}>
        <button onMouseDown={()=>onToggleLike(r)} style={{fontSize:13,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:liked?'#E24B4A':'#bbb',padding:0}}>
          {liked?'♥':'♡'} {likeCount}
        </button>
        <button onMouseDown={()=>onToggleComments(r.id)} style={{fontSize:13,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:expanded?'#333':'#bbb',padding:0}}>
          💬 {ratingComments.length}
        </button>
        <button onMouseDown={()=>onOpenComment(r)} style={{fontSize:12,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:'#bbb',padding:0}}>+ Commenter</button>
        {showDelete && <button onMouseDown={()=>onDelete(r.id)} style={{fontSize:11,color:'#E24B4A',background:'transparent',border:'0.5px solid #E24B4A',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit',marginLeft:'auto'}}>Supprimer</button>}
        {onOpenRating && <button onMouseDown={onOpenRating} style={{fontSize:11,color:'#555',background:'transparent',border:'0.5px solid #ccc',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit',marginLeft:showDelete?4:'auto'}}>Modifier</button>}
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [tab, setTab] = useState('matches')
  const [matches, setMatches] = useState([])
  const [ratings, setRatings] = useState([])
  const [likes, setLikes] = useState([])
  const [comments, setComments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [messages, setMessages] = useState([])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [modal, setModal] = useState(null)
  const [editingRating, setEditingRating] = useState(null)
  const [modalStars, setModalStars] = useState(0)
  const [modalComment, setModalComment] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [friendFeed, setFriendFeed] = useState([])
  const [friends, setFriends] = useState([])
  const [friendIds, setFriendIds] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [confirmModal, setConfirmModal] = useState(null)
  const [commentModal, setCommentModal] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sortProfil, setSortProfil] = useState('recent')
  const [chatFriend, setChatFriend] = useState(null)
  const [chatText, setChatText] = useState('')
  const [expandedComments, setExpandedComments] = useState({})
  const [now, setNow] = useState(Date.now())
  const [sportFilter, setSportFilter] = useState('Tous')
  const chatBottomRef = useRef(null)
  const commentInputRef = useRef(null)
  const chatInputRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
    })
    fetchMatches()
    fetchAllRatings()
    const channel = supabase.channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, fetchAllRatings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchLikes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchComments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    if (user) { fetchProfile(); fetchPendingRequests(); fetchFriends(); fetchLikes(); fetchComments(); fetchNotifications(); fetchMessages() }
  }, [user])

  useEffect(() => { if (profile) fetchFriendFeed() }, [profile, ratings, friendIds])

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatFriend])

  useEffect(() => {
    if (commentModal) setTimeout(() => commentInputRef.current?.focus(), 100)
  }, [commentModal])

  async function fetchMatches() {
    const res = await fetch('/api/matches')
    setMatches(await res.json())
  }
  async function fetchAllRatings() {
    const { data } = await supabase.from('ratings').select('*, profiles(username, avatar_initials)').order('created_at', { ascending: false })
    setRatings(data || [])
  }
  async function fetchLikes() {
    const { data } = await supabase.from('likes').select('*')
    setLikes(data || [])
  }
  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(username, avatar_initials)').order('created_at', { ascending: true })
    setComments(data || [])
  }
  async function fetchNotifications() {
    if (!user) return
    const { data } = await supabase.from('notifications').select('*, profiles!notifications_from_user_id_fkey(username)').eq('user_id', user.id).order('created_at', { ascending: false })
    setNotifications(data || [])
  }
  async function fetchMessages() {
    if (!user) return
    const { data } = await supabase.from('messages').select('*, profiles!messages_from_user_id_fkey(username, avatar_initials)').or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`).order('created_at', { ascending: true })
    setMessages(data || [])
  }
  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
  }
  async function fetchFriends() {
    const { data } = await supabase.from('friendships').select('friend_id, profiles!friendships_friend_id_fkey(id, username, avatar_initials)').eq('user_id', user.id).eq('status', 'accepted')
    setFriends(data || [])
    setFriendIds((data || []).map(f => f.friend_id))
  }
  async function fetchFriendFeed() {
    if (!friendIds.length) { setFriendFeed([]); return }
    const { data } = await supabase.from('ratings').select('*, profiles(username, avatar_initials)').in('user_id', friendIds).order('created_at', { ascending: false })
    setFriendFeed(data || [])
  }
  async function fetchPendingRequests() {
    const { data } = await supabase.from('friendships').select('*, profiles!friendships_user_id_fkey(username, avatar_initials)').eq('friend_id', user.id).eq('status', 'pending')
    setPendingRequests(data || [])
  }

  async function handleAuth() {
    setLoading(true)
    if (authMode === 'signup') {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single()
      if (existing) { showConfirm({ title: 'Nom déjà pris', message: 'Ce nom est déjà utilisé.', single: true }); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (!error && data.user) await supabase.from('profiles').insert({ id: data.user.id, username, avatar_initials: username.slice(0,2).toUpperCase() })
      showConfirm({ title: error ? 'Erreur' : 'Compte créé !', message: error ? error.message : 'Vérifie tes emails.', single: true })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) showConfirm({ title: 'Erreur', message: error.message, single: true })
    }
    setLoading(false)
  }

  async function handleLogout() { await supabase.auth.signOut(); setUser(null); setProfile(null) }

  function openRatingModal(match) {
    const existing = ratings.find(r => r.match_id === match.id && r.user_id === user?.id)
    if (existing) { setEditingRating(existing); setModalStars(existing.stars); setModalComment(existing.comment || '') }
    else { setEditingRating(null); setModalStars(0); setModalComment('') }
    setModal(match)
  }

  async function submitRating() {
    if (modalStars === 0) { showConfirm({ title: 'Note manquante', message: 'Choisis une note.', single: true }); return }
    if (editingRating) {
      await supabase.from('ratings').update({ stars: modalStars, comment: modalComment }).eq('id', editingRating.id)
    } else {
      await supabase.from('ratings').insert({ user_id: user.id, match_id: modal.id, match_teams: modal.teams, match_score: modal.score, match_league: modal.league, match_date: modal.date, stars: modalStars, comment: modalComment })
    }
    setModal(null); setModalStars(0); setModalComment(''); setEditingRating(null)
    fetchAllRatings()
  }

  async function deleteRating(ratingId) {
    showConfirm({ title: 'Supprimer cette note ?', message: 'Cette action est irréversible.', onConfirm: async () => { await supabase.from('ratings').delete().eq('id', ratingId); fetchAllRatings() } })
  }

  async function toggleLike(rating) {
    if (!user) return
    const existing = likes.find(l => l.rating_id === rating.id && l.user_id === user.id)
    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, rating_id: rating.id })
      if (rating.user_id !== user.id) await supabase.from('notifications').insert({ user_id: rating.user_id, from_user_id: user.id, type: 'like', rating_id: rating.id })
    }
    fetchLikes()
  }

  async function submitComment() {
    if (!commentText.trim()) return
    await supabase.from('comments').insert({ user_id: user.id, rating_id: commentModal.id, content: commentText.trim(), parent_id: replyTo?.id || null })
    if (commentModal.user_id !== user.id) {
      await supabase.from('notifications').insert({ user_id: commentModal.user_id, from_user_id: user.id, type: 'comment', rating_id: commentModal.id, comment_content: commentText.trim() })
    }
    setCommentText(''); setReplyTo(null)
    fetchComments()
    setTimeout(() => commentInputRef.current?.focus(), 50)
  }

  async function sendMessage() {
    if (!chatText.trim() || !chatFriend) return
    await supabase.from('messages').insert({ from_user_id: user.id, to_user_id: chatFriend.friend_id, content: chatText.trim() })
    setChatText('')
    fetchMessages()
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }

  async function sendMatchInChat(match, friendOverride) {
    const target = friendOverride || chatFriend
    if (!target) return
    await supabase.from('messages').insert({ from_user_id: user.id, to_user_id: target.friend_id, match_id: match.id, match_teams: match.teams, match_score: match.score })
    fetchMessages()
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    fetchNotifications()
  }

  async function sendFriendRequest(friendUsername) {
    if (!friendUsername) return
    const { data: fp } = await supabase.from('profiles').select('id').eq('username', friendUsername).single()
    if (!fp) { showConfirm({ title: 'Introuvable', message: 'Aucun utilisateur avec ce nom.', single: true }); return }
    if (fp.id === user.id) { showConfirm({ title: 'Erreur', message: 'Tu ne peux pas t\'ajouter toi-même.', single: true }); return }
    const { error } = await supabase.from('friendships').insert({ user_id: user.id, friend_id: fp.id, status: 'pending' })
    if (error) { showConfirm({ title: 'Déjà envoyée', message: 'Demande déjà envoyée.', single: true }); return }
    showConfirm({ title: 'Demande envoyée !', message: `@${friendUsername} recevra ta demande.`, single: true })
  }

  async function acceptFriend(requestId, friendId) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId)
    await supabase.from('friendships').insert({ user_id: user.id, friend_id: friendId, status: 'accepted' })
    fetchPendingRequests(); fetchFriends(); fetchFriendFeed()
  }

  async function declineFriend(requestId) { await supabase.from('friendships').delete().eq('id', requestId); fetchPendingRequests() }

  async function removeFriend(friendId, friendUsername) {
    showConfirm({ title: 'Retirer cet ami ?', message: `@${friendUsername} ne sera plus dans ta liste.`, onConfirm: async () => {
      await supabase.from('friendships').delete().eq('user_id', user.id).eq('friend_id', friendId)
      await supabase.from('friendships').delete().eq('user_id', friendId).eq('friend_id', user.id)
      fetchFriends(); fetchFriendFeed()
    }})
  }

  function showConfirm({ title, message, onConfirm, single }) { setConfirmModal({ title, message, onConfirm, single }) }

  function getMyRating(matchId) { return ratings.find(r => r.match_id === matchId && r.user_id === user?.id) }
  function getFriendRatings(matchId) { return ratings.filter(r => r.match_id === matchId && friendIds.includes(r.user_id)) }
  function getMatchRatings(matchId) { return ratings.filter(r => r.match_id === matchId && (r.user_id === user?.id || friendIds.includes(r.user_id))) }
  function toggleComments(ratingId) { setExpandedComments(prev => ({ ...prev, [ratingId]: !prev[ratingId] })) }
  function isUpcoming(match) { return match.score === 'À venir' }
  function getChatMessages() {
    if (!chatFriend) return []
    return messages.filter(m => (m.from_user_id === user.id && m.to_user_id === chatFriend.friend_id) || (m.from_user_id === chatFriend.friend_id && m.to_user_id === user.id))
  }

  function timeAgo(dateStr) {
    const diff = (now - new Date(dateStr)) / 1000
    if (diff < 60) return "À l'instant"
    if (diff < 3600) return `Il y a ${Math.floor(diff/60)}min`
    if (diff < 86400) return `Il y a ${Math.floor(diff/3600)}h`
    return `Il y a ${Math.floor(diff/86400)}j`
  }

  function getSortedMyRatings() {
    const r = [...ratings.filter(x => x.user_id === user?.id)]
    if (sortProfil === 'recent') return r.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortProfil === 'ancien') return r.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortProfil === 'meilleures') return r.sort((a,b) => b.stars - a.stars)
    if (sortProfil === 'mauvaises') return r.sort((a,b) => a.stars - b.stars)
    return r
  }

  const filteredMatches = sportFilter === 'Tous' ? matches : matches.filter(m => m.sport === sportFilter)
  const unreadCount = notifications.filter(n => !n.read).length

  const ratingCardProps = { likes, comments, user, friendIds, expandedComments, onToggleLike: toggleLike, onToggleComments: toggleComments, onOpenComment: (r) => { setCommentModal(r); setCommentText(''); setReplyTo(null) }, onReply: (r, c) => { setCommentModal(r); setReplyTo(c) }, onDelete: deleteRating, timeAgo, router }

  if (!user) return (
    <div style={{maxWidth:380,margin:'60px auto',padding:'0 1rem'}}>
      <h1 style={{fontSize:24,fontWeight:500,marginBottom:8}}>Kickrate</h1>
      <p style={{color:'#888',marginBottom:24,fontSize:14}}>Note les matchs, partage avec tes amis.</p>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button onClick={()=>setAuthMode('login')} style={{flex:1,padding:'8px',background:authMode==='login'?'#000':'transparent',color:authMode==='login'?'#fff':'inherit',border:'0.5px solid #ccc',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>Connexion</button>
        <button onClick={()=>setAuthMode('signup')} style={{flex:1,padding:'8px',background:authMode==='signup'?'#000':'transparent',color:authMode==='signup'?'#fff':'inherit',border:'0.5px solid #ccc',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>Inscription</button>
      </div>
      {authMode==='signup' && <input placeholder="Nom d'utilisateur" value={username} onChange={e=>setUsername(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:8,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />}
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:8,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />
      <input placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:'8px 12px',marginBottom:12,border:'0.5px solid #ccc',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit'}} />
      <button onClick={handleAuth} disabled={loading} style={{width:'100%',padding:'10px',background:'#000',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Chargement...':authMode==='login'?'Se connecter':'Créer le compte'}
      </button>
    </div>
  )

  return (
    <div style={{maxWidth:440,margin:'0 auto',padding:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <span style={{fontSize:20,fontWeight:500}}>Kickrate</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13,color:'#888'}}>@{profile?.username}</span>
          <button onClick={handleLogout} style={{fontSize:12,color:'#888',background:'transparent',border:'0.5px solid #ccc',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontFamily:'inherit'}}>Déco</button>
        </div>
      </div>

      <div style={{display:'flex',border:'0.5px solid #ddd',borderRadius:10,overflow:'hidden',marginBottom:20}}>
        {['matches','feed','chat','notifs','profil'].map(t=>(
          <button key={t} onClick={()=>{ setTab(t); if(t==='notifs') markAllRead() }} style={{flex:1,padding:'8px 0',fontSize:11,background:tab===t?'#f5f5f5':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:tab===t?500:400,position:'relative'}}>
            {t==='matches'?'Matchs':t==='feed'?'Amis':t==='chat'?'Chat':t==='notifs'?'Notifs':'Profil'}
            {t==='feed'&&pendingRequests.length>0&&<span style={{position:'absolute',top:4,right:4,background:'#E24B4A',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingRequests.length}</span>}
            {t==='notifs'&&unreadCount>0&&<span style={{position:'absolute',top:4,right:4,background:'#E24B4A',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center'}}>{unreadCount}</span>}
          </button>
        ))}
      </div>

      {tab==='matches' && (
        <div>
          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
            {['Tous','Football','Basket','Tennis','F1'].map(s=>(
              <button key={s} onClick={()=>setSportFilter(s)} style={{padding:'4px 12px',fontSize:12,border:'0.5px solid #ddd',borderRadius:20,background:sportFilter===s?'#000':'transparent',color:sportFilter===s?'#fff':'#666',cursor:'pointer',fontFamily:'inherit'}}>{s}</button>
            ))}
          </div>
          {filteredMatches.length===0&&<p style={{color:'#aaa',fontSize:14}}>Aucun match.</p>}
          {filteredMatches.map(m=>{
            const myRating = getMyRating(m.id)
            const friendRatings = getFriendRatings(m.id)
            const allRatings = getMatchRatings(m.id)
            const avg = allRatings.length?(allRatings.reduce((a,r)=>a+r.stars,0)/allRatings.length).toFixed(1):null
            const upcoming = isUpcoming(m)
            return (
              <div key={m.id} style={{background:'var(--background)',border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:11,background:'#f5f5f5',padding:'2px 8px',borderRadius:20,color:'#666'}}>{m.league}</span>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {upcoming&&<span style={{fontSize:11,background:'#FFF3CD',color:'#856404',padding:'2px 8px',borderRadius:20}}>À venir</span>}
                    <span style={{fontSize:11,color:'#aaa'}}>{m.date}</span>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:15,fontWeight:500}}>{m.teams}</span>
                  {!upcoming&&<span style={{fontSize:18,fontWeight:500}}>{m.score}</span>}
                </div>
                <div style={{borderTop:'0.5px solid #eee',paddingTop:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:friendRatings.length>0?8:0}}>
                    <div>
                      {myRating
                        ? <span onClick={()=>!upcoming&&openRatingModal(m)} style={{color:'#EF9F27',fontSize:13,cursor:'pointer'}}>{'★'.repeat(myRating.stars)}{'☆'.repeat(5-myRating.stars)} <span style={{fontSize:11,color:'#aaa'}}>Ma note</span></span>
                        : <button onClick={()=>!upcoming&&openRatingModal(m)} disabled={upcoming} style={{fontSize:12,color:upcoming?'#ccc':'#333',background:'transparent',border:`0.5px solid ${upcoming?'#eee':'#ccc'}`,borderRadius:6,padding:'3px 8px',cursor:upcoming?'default':'pointer',fontFamily:'inherit'}}>{upcoming?'Match à venir':'Noter'}</button>
                      }
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {avg&&<span style={{fontSize:11,color:'#aaa'}}>⭐ {avg} ({allRatings.length})</span>}
                      <button onClick={()=>{ if(friends.length===0){showConfirm({title:'Aucun ami',message:'Ajoute des amis pour partager.',single:true});return} if(friends.length===1){sendMatchInChat(m,friends[0]);showConfirm({title:'Partagé !',message:`Envoyé à @${friends[0].profiles?.username}`,single:true});return} showConfirm({title:'Partager',message:'Va dans le Chat pour partager ce match avec un ami spécifique.',single:true}) }} style={{fontSize:11,color:'#185FA5',background:'transparent',border:'0.5px solid #185FA5',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>Partager</button>
                    </div>
                  </div>
                  {friendRatings.length>0&&(
                    <div style={{marginTop:6,padding:'8px',background:'#f9f9f9',borderRadius:8}}>
                      {friendRatings.map(fr=>(
                        <div key={fr.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:500,color:'#444'}}>@{fr.profiles?.username}</span>
                          <span style={{color:'#EF9F27',fontSize:12}}>{'★'.repeat(fr.stars)}{'☆'.repeat(5-fr.stars)}</span>
                          {fr.comment&&<span style={{fontSize:11,color:'#555',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fr.comment}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab==='feed' && (
        <div>
          {pendingRequests.length>0&&(
            <div style={{marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:500,marginBottom:8}}>Demandes reçues</p>
              {pendingRequests.map(req=>(
                <div key={req.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',border:'0.5px solid #ddd',borderRadius:10,marginBottom:8}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#185FA5'}}>{req.profiles?.avatar_initials}</div>
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>@{req.profiles?.username}</span>
                  <button onClick={()=>acceptFriend(req.id,req.user_id)} style={{padding:'4px 10px',background:'#000',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Accepter</button>
                  <button onClick={()=>declineFriend(req.id)} style={{padding:'4px 10px',background:'transparent',border:'0.5px solid #ddd',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Refuser</button>
                </div>
              ))}
            </div>
          )}
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <input id="friend-input" placeholder="Nom d'utilisateur" style={{flex:1,padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}} />
            <button onClick={()=>sendFriendRequest(document.getElementById('friend-input').value)} style={{padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Ajouter</button>
          </div>
          {friends.length>0&&(
            <div style={{marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:500,marginBottom:8}}>Mes amis</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                {friends.map(f=>(
                  <div key={f.friend_id} style={{border:'0.5px solid #ddd',borderRadius:10,padding:'10px 12px'}}>
                    <div onClick={()=>router.push(`/profil/${f.profiles?.username}`)} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:8}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#185FA5'}}>{f.profiles?.avatar_initials}</div>
                      <span style={{fontSize:13,fontWeight:500}}>@{f.profiles?.username}</span>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setChatFriend(f);setTab('chat')}} style={{flex:1,fontSize:11,color:'#185FA5',background:'transparent',border:'0.5px solid #185FA5',borderRadius:6,padding:'3px 6px',cursor:'pointer',fontFamily:'inherit'}}>Chat</button>
                      <button onClick={()=>removeFriend(f.friend_id,f.profiles?.username)} style={{flex:1,fontSize:11,color:'#E24B4A',background:'transparent',border:'0.5px solid #E24B4A',borderRadius:6,padding:'3px 6px',cursor:'pointer',fontFamily:'inherit'}}>Retirer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={{fontSize:13,fontWeight:500,marginBottom:8}}>Fil d'actualité</p>
          {friendFeed.length===0&&<p style={{color:'#aaa',fontSize:14}}>Aucune note de tes amis pour l'instant.</p>}
          {friendFeed.map(r=><RatingCard key={r.id} r={r} showDelete={false} {...ratingCardProps} />)}
        </div>
      )}

      {tab==='chat' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            {friends.map(f=>(
              <button key={f.friend_id} onClick={()=>setChatFriend(f)} style={{padding:'6px 12px',fontSize:13,border:'0.5px solid #ddd',borderRadius:20,background:chatFriend?.friend_id===f.friend_id?'#000':'transparent',color:chatFriend?.friend_id===f.friend_id?'#fff':'inherit',cursor:'pointer',fontFamily:'inherit'}}>
                @{f.profiles?.username}
              </button>
            ))}
          </div>
          {!chatFriend&&<p style={{color:'#aaa',fontSize:14}}>Sélectionne un ami pour chatter.</p>}
          {chatFriend&&(
            <div>
              <div style={{border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:12,minHeight:300,maxHeight:400,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                {getChatMessages().length===0&&<p style={{color:'#aaa',fontSize:13,textAlign:'center',margin:'auto'}}>Commencez à chatter !</p>}
                {getChatMessages().map(m=>(
                  <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:m.from_user_id===user.id?'flex-end':'flex-start'}}>
                    {m.content&&<div style={{background:m.from_user_id===user.id?'#000':'#f0f0f0',color:m.from_user_id===user.id?'#fff':'#222',padding:'8px 12px',borderRadius:12,maxWidth:'80%',fontSize:13}}>{m.content}</div>}
                    {m.match_teams&&(
                      <div style={{background:m.from_user_id===user.id?'#222':'#f0f0f0',borderRadius:10,padding:'8px 12px',maxWidth:'80%'}}>
                        <div style={{fontSize:11,color:m.from_user_id===user.id?'#aaa':'#888',marginBottom:2}}>Match partagé</div>
                        <div style={{fontSize:13,fontWeight:500,color:m.from_user_id===user.id?'#fff':'#222'}}>{m.match_teams}</div>
                        <div style={{fontSize:12,color:m.from_user_id===user.id?'#ccc':'#555'}}>{m.match_score}</div>
                      </div>
                    )}
                    <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{timeAgo(m.created_at)}</div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div style={{marginBottom:12}}>
                <p style={{fontSize:12,color:'#aaa',marginBottom:6}}>Partager un match :</p>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
                  {matches.slice(0,5).map(m=>(
                    <button key={m.id} onClick={()=>sendMatchInChat(m)} style={{flexShrink:0,padding:'4px 10px',fontSize:11,border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>{m.teams}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <input
                  ref={chatInputRef}
                  value={chatText}
                  onChange={e=>setChatText(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&sendMessage()}
                  placeholder="Message..."
                  style={{flex:1,padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}}
                />
                <button onClick={sendMessage} style={{padding:'8px 14px',border:'none',borderRadius:8,background:'#000',color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>↑</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='notifs' && (
        <div>
          <p style={{fontSize:13,fontWeight:500,marginBottom:12}}>Notifications</p>
          {notifications.length===0&&<p style={{color:'#aaa',fontSize:14}}>Aucune notification.</p>}
          {notifications.map(n=>(
            <div key={n.id} style={{border:'0.5px solid #ddd',borderRadius:10,padding:'10px 14px',marginBottom:8,background:n.read?'var(--background)':'#f9f9f9'}}>
              <div style={{fontSize:13,color:'#333'}}>
                <span style={{fontWeight:500}}>@{n.profiles?.username}</span>
                {n.type==='like'?' a aimé ta note.':' a commenté ta note :'}
                {n.type==='comment'&&n.comment_content&&<span style={{color:'#444',fontStyle:'italic'}}> « {n.comment_content} »</span>}
              </div>
              <div style={{fontSize:11,color:'#aaa',marginTop:2}}>{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='profil' && (
        <div>
          <div style={{border:'0.5px solid #ddd',borderRadius:12,padding:'1rem',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:50,height:50,borderRadius:'50%',background:'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,color:'#185FA5'}}>{profile?.avatar_initials}</div>
            <div>
              <div style={{fontWeight:500}}>@{profile?.username}</div>
              <div style={{fontSize:13,color:'#aaa'}}>{user?.email}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:16}}>
            <div style={{background:'#f5f5f5',borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:500}}>{ratings.filter(r=>r.user_id===user.id).length}</div>
              <div style={{fontSize:11,color:'#666'}}>Matchs notés</div>
            </div>
            <div style={{background:'#f5f5f5',borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:500}}>{ratings.filter(r=>r.user_id===user.id).length?(ratings.filter(r=>r.user_id===user.id).reduce((a,r)=>a+r.stars,0)/ratings.filter(r=>r.user_id===user.id).length).toFixed(1):'-'}</div>
              <div style={{fontSize:11,color:'#666'}}>Note moyenne</div>
            </div>
          </div>
          <SortBar value={sortProfil} onChange={setSortProfil} />
          {getSortedMyRatings().map(r=>{
            const match = matches.find(m=>m.id===r.match_id)
            return <RatingCard key={r.id} r={r} showDelete={true} onOpenRating={match?()=>openRatingModal(match):null} {...ratingCardProps} />
          })}
        </div>
      )}

      {modal&&(
        <Overlay onClose={()=>{setModal(null);setEditingRating(null)}}>
          <div style={{background:'var(--background)',borderRadius:16,padding:'1.5rem',width:340,maxWidth:'90vw',border:'0.5px solid #ddd'}}>
            <div style={{fontSize:16,fontWeight:500,marginBottom:12}}>{editingRating?'Modifier ta note':'Noter ce match'}</div>
            <div style={{background:'#f0f0f0',borderRadius:10,padding:'12px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:17,fontWeight:500,color:'#222'}}>{modal.teams}</div>
              <div style={{fontSize:13,color:'#555'}}>{modal.score} · {modal.league}</div>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:16}}>
              {[1,2,3,4,5].map(s=><span key={s} onClick={()=>setModalStars(s)} style={{fontSize:32,cursor:'pointer',color:s<=modalStars?'#EF9F27':'#ddd'}}>★</span>)}
            </div>
            <textarea value={modalComment} onChange={e=>setModalComment(e.target.value)} placeholder="Ton avis... (optionnel)" style={{width:'100%',padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,resize:'none',height:70,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}} />
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>{setModal(null);setEditingRating(null)}} style={{flex:1,padding:'9px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
              <button onClick={submitRating} style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:'#000',color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>{editingRating?'Modifier':'Publier'}</button>
            </div>
          </div>
        </Overlay>
      )}

      {commentModal&&(
        <Overlay onClose={()=>{setCommentModal(null);setReplyTo(null)}}>
          <div style={{background:'var(--background)',borderRadius:16,padding:'1.5rem',width:360,maxWidth:'90vw',border:'0.5px solid #ddd'}}>
            <div style={{fontSize:16,fontWeight:500,marginBottom:12}}>Commentaires</div>
            <div style={{background:'#f0f0f0',borderRadius:8,padding:'8px 12px',marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:500,color:'#222'}}>{commentModal.match_teams}</div>
              <div style={{fontSize:12,color:'#555'}}>{commentModal.match_score} · {'★'.repeat(commentModal.stars)}</div>
            </div>
            <div style={{maxHeight:200,overflowY:'auto',marginBottom:12}}>
              {comments.filter(c=>c.rating_id===commentModal.id&&!c.parent_id).length===0&&<p style={{fontSize:13,color:'#aaa'}}>Aucun commentaire.</p>}
              {comments.filter(c=>c.rating_id===commentModal.id&&!c.parent_id).map(c=>(
                <div key={c.id} style={{marginBottom:8,paddingBottom:8,borderBottom:'0.5px solid #eee'}}>
                  <span style={{fontSize:12,fontWeight:500,color:'#222'}}>@{c.profiles?.username} </span>
                  <span style={{fontSize:12,color:'#333'}}>{c.content}</span>
                  <div>
                    <button onMouseDown={()=>setReplyTo(c)} style={{fontSize:11,color:'#888',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>Répondre</button>
                  </div>
                  {comments.filter(r=>r.parent_id===c.id).map(reply=>(
                    <div key={reply.id} style={{marginTop:4,paddingLeft:8,borderLeft:'2px solid #eee'}}>
                      <span style={{fontSize:11,fontWeight:500,color:'#222'}}>@{reply.profiles?.username} </span>
                      <span style={{fontSize:11,color:'#333'}}>{reply.content}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {replyTo&&<div style={{fontSize:12,color:'#555',marginBottom:6,padding:'4px 8px',background:'#f0f0f0',borderRadius:6}}>Réponse à @{replyTo.profiles?.username} <button onMouseDown={()=>setReplyTo(null)} style={{marginLeft:8,fontSize:11,color:'#888',background:'transparent',border:'none',cursor:'pointer'}}>✕</button></div>}
            <div style={{display:'flex',gap:8}}>
              <input
                ref={commentInputRef}
                value={commentText}
                onChange={e=>setCommentText(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&submitComment()}
                placeholder={replyTo?`Répondre à @${replyTo.profiles?.username}...`:"Ton commentaire..."}
                style={{flex:1,padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',color:'inherit',fontFamily:'inherit',fontSize:13}}
                autoFocus
              />
              <button onMouseDown={submitComment} style={{padding:'8px 14px',border:'none',borderRadius:8,background:'#000',color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>↑</button>
            </div>
          </div>
        </Overlay>
      )}

      {confirmModal&&(
        <Overlay onClose={()=>setConfirmModal(null)}>
          <div style={{background:'var(--background)',borderRadius:16,padding:'1.5rem',width:300,maxWidth:'90vw',border:'0.5px solid #ddd'}}>
            <div style={{fontSize:16,fontWeight:500,marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#555',marginBottom:20,lineHeight:1.5}}>{confirmModal.message}</div>
            <div style={{display:'flex',gap:8}}>
              {!confirmModal.single&&<button onClick={()=>setConfirmModal(null)} style={{flex:1,padding:'9px',border:'0.5px solid #ddd',borderRadius:8,background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>Annuler</button>}
              <button onClick={()=>{confirmModal.onConfirm?.();setConfirmModal(null)}} style={{flex:1,padding:'9px',border:'none',borderRadius:8,background:'#000',color:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>OK</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}