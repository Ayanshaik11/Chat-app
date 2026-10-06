import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{ActivityIndicator,Alert,Animated,FlatList,Image,KeyboardAvoidingView,Modal,PanResponder,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View}from'react-native';
import*as Clipboard from'expo-clipboard';
import*as Haptics from'expo-haptics';
import{collection,limit,onSnapshot,orderBy,query}from'firebase/firestore';
import{db}from'../config/firebase';
import{chatIdFor,deleteMessageForMe,markChatRead,markMessagesSeen,reactToMessage,removeReaction,sendMessage,unsendMessage}from'../services/chat';

const RED='#E11D2A',BG='#080808',CARD2='#171717',BORDER='#292929',TEXT='#FFF',MUTED='#8F8F8F';
const QUICK_REACTIONS=['❤️','😂','😅','😢','🔥'];
const EXTRA_REACTIONS=['👍','👎','👏','🙌','😍','🥰','😘','🤣','😎','🤔','😮','😱','😡','😭','🥹','🤗','😴','🤩','💀','🤝','🙏','💯','✨','🎉','💔','❤️‍🔥','🫶','👀','🚀','😈'];

function toMillis(v){
  try{
    if(!v)return 0;
    if(typeof v.toMillis==='function')return v.toMillis();
    if(typeof v.toDate==='function')return v.toDate().getTime();
    if(v instanceof Date)return v.getTime();
    const n=new Date(v).getTime();return Number.isNaN(n)?0:n;
  }catch{return 0}
}

function formatSeenTime(v){
  const m=toMillis(v);if(!m)return'Seen just now';
  const d=Math.max(0,Date.now()-m);
  if(d<60000)return'Seen just now';
  if(d<3600000)return`Seen ${Math.floor(d/60000)}m ago`;
  if(d<86400000)return`Seen ${Math.floor(d/3600000)}h ago`;
  return`Seen ${new Date(m).toLocaleDateString()}`;
}

function MessageRow({item,showSeen,onLongPress,onReply,onReactionPress,inputRef}){
  const meId=item._meId,isMine=item.senderId===meId;
  const translateX=useRef(new Animated.Value(0)).current,pressScale=useRef(new Animated.Value(1)).current,longPressed=useRef(false);

  const pressIn=()=>Animated.timing(pressScale,{toValue:.97,duration:60,useNativeDriver:true}).start();
  const pressOut=()=>Animated.spring(pressScale,{toValue:1,speed:30,bounciness:5,useNativeDriver:true}).start();

  const longPress=async()=>{
    if(longPressed.current)return;
    longPressed.current=true;
    try{await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}catch{}
    onLongPress(item);
    setTimeout(()=>{longPressed.current=false},250);
  };

  const panResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    onMoveShouldSetPanResponder:(_,g)=>g.dx<-8&&Math.abs(g.dx)>Math.abs(g.dy)&&Math.abs(g.dx)>8,
    onPanResponderMove:(_,g)=>{if(g.dx<0)translateX.setValue(Math.max(g.dx,-82))},
    onPanResponderRelease:(_,g)=>{
      if(g.dx<=-55){
        Animated.timing(translateX,{toValue:0,duration:100,useNativeDriver:true}).start();
        onReply(item);
        requestAnimationFrame(()=>inputRef?.current?.focus());
      }else Animated.timing(translateX,{toValue:0,duration:80,useNativeDriver:true}).start();
    },
    onPanResponderTerminate:()=>Animated.timing(translateX,{toValue:0,duration:80,useNativeDriver:true}).start()
  }),[inputRef,item,onReply,translateX]);

  const reactions=item.reactions?Object.entries(item.reactions):[],reactionCounts={};
  reactions.forEach(([,e])=>{if(e)reactionCounts[e]=(reactionCounts[e]||0)+1});

  const hasReply=!!item.replyTo&&!item.unsent;
  const replySenderName=item.replyTo?.senderId===meId?'You':item.replyTo?.senderName||'Message';

  return <View style={[styles.messageOuter,{alignItems:isMine?'flex-end':'flex-start'}]}>
    <Animated.View {...panResponder.panHandlers} style={[styles.messageAnimated,isMine?styles.messageAnimatedMine:styles.messageAnimatedOther,{transform:[{translateX},{scale:pressScale}]}]}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onLongPress={longPress} delayLongPress={300} style={[styles.messageBubble,isMine?styles.myBubble:styles.otherBubble,item.unsent&&styles.unsentBubble]}>
        {hasReply&&<View style={styles.replyQuote}><View style={styles.replyAccent}/><View style={styles.replyQuoteContent}>
          <Text style={styles.replyQuoteTitle} numberOfLines={1}>{replySenderName}</Text>
          <Text style={styles.replyQuoteText} numberOfLines={2}>{String(item.replyTo?.text||'Message')}</Text>
        </View></View>}
        <Text style={[styles.messageText,item.unsent&&styles.unsentText]}>{String(item.text||'')}</Text>
        {item.unsent&&<Text style={styles.unsentLabel}>Unsent message</Text>}
      </Pressable>

      {Object.keys(reactionCounts).length>0&&<View style={[styles.reactionRow,isMine?styles.reactionRowMine:styles.reactionRowOther]}>
        {Object.entries(reactionCounts).map(([emoji,count])=><TouchableOpacity key={emoji} style={styles.reactionChip} onPress={()=>onReactionPress(item,emoji)}>
          <Text style={styles.reactionEmoji}>{emoji}</Text>{count>1&&<Text style={styles.reactionCount}>{count}</Text>}
        </TouchableOpacity>)}
      </View>}
    </Animated.View>
    {showSeen&&<Text style={styles.seenText}>{formatSeenTime(item.seenBy?.[item._otherId])}</Text>}
  </View>;
}

export default function ChatScreen({route,navigation}){
  const{user,otherUser,friendProfiles={}}=route.params||{},me=user||{},other=otherUser||{};
  const meId=me.id||me.uid||null,otherId=other.id||other.uid||null,chatId=chatIdFor(meId,otherId);

  const otherProfile=friendProfiles?.[otherId]||other;
  const otherPhoto=otherProfile?.photoURL||otherProfile?.photoUrl||otherProfile?.profilePic||otherProfile?.avatar||'';
  const otherName=otherProfile?.displayName||otherProfile?.name||'User';

  const[messages,setMessages]=useState([]),[loading,setLoading]=useState(true),[text,setText]=useState('');
  const[replyingTo,setReplyingTo]=useState(null),[menuMessage,setMenuMessage]=useState(null);
  const[reactionMessage,setReactionMessage]=useState(null),[reactionEmoji,setReactionEmoji]=useState(null);
  const[showExtraReactions,setShowExtraReactions]=useState(false),[showForward,setShowForward]=useState(false);
  const[selectedFriends,setSelectedFriends]=useState([]),[sending,setSending]=useState(false);
  const inputRef=useRef(null),menuAnim=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(!meId||!otherId||!chatId){setLoading(false);return}
    const q=query(collection(db,'chats',chatId,'messages'),orderBy('createdAt','desc'),limit(80));
    return onSnapshot(q,async snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!(m.deletedFor||[]).includes(meId));
      const mapped=data.map(m=>({...m,_meId:meId,_otherId:otherId}));
      setMessages(mapped);setLoading(false);
      try{await markChatRead(chatId,meId);await markMessagesSeen(chatId,mapped,meId)}catch(e){console.log('Read/seen error:',e?.message||e)}
    },e=>{console.log('Messages listener error:',e?.message||e);setLoading(false)});
  },[chatId,meId,otherId]);

  const latestSeenMessageId=useMemo(()=>{
    const x=messages.find(m=>m.senderId===meId&&m.seenBy?.[otherId]);return x?.id||null;
  },[messages,meId,otherId]);

  const closeMenu=useCallback(()=>{
    Animated.timing(menuAnim,{toValue:0,duration:90,useNativeDriver:true}).start(()=>setMenuMessage(null));
  },[menuAnim]);

  const openMenu=useCallback(message=>{
    setMenuMessage(message);menuAnim.setValue(0);
    requestAnimationFrame(()=>Animated.timing(menuAnim,{toValue:1,duration:110,useNativeDriver:true}).start());
  },[menuAnim]);

  const handleReply=useCallback(message=>{
    if(!message||message.unsent)return;
    setReplyingTo(message);closeMenu();
    requestAnimationFrame(()=>inputRef.current?.focus());
  },[closeMenu]);

  const handleReaction=async emoji=>{
    if(!menuMessage?.id)return;
    try{await reactToMessage(chatId,menuMessage.id,meId,emoji);setShowExtraReactions(false);closeMenu()}
    catch(e){Alert.alert('Reaction failed',e?.message||'Unable to react.')}
  };

  const handleReactionPress=(message,emoji)=>{
    if(message.reactions?.[meId]===emoji){setReactionMessage(message);setReactionEmoji(emoji)}
    else{setMenuMessage(message);menuAnim.setValue(0);requestAnimationFrame(()=>Animated.timing(menuAnim,{toValue:1,duration:110,useNativeDriver:true}).start())}
  };

  const removeMyReaction=async()=>{
    if(!reactionMessage?.id)return;
    try{await removeReaction(chatId,reactionMessage.id,meId)}catch(e){Alert.alert('Error',e?.message||'Could not remove reaction.')}
    finally{setReactionMessage(null);setReactionEmoji(null)}
  };

  const handleUnsend=async()=>{
    if(!menuMessage?.id)return;closeMenu();
    try{await unsendMessage(chatId,menuMessage.id,meId)}catch(e){Alert.alert('Error',e?.message||'Could not unsend message.')}
  };

  const handleDeleteForMe=async()=>{
    if(!menuMessage?.id)return;closeMenu();
    try{await deleteMessageForMe(chatId,menuMessage.id,meId)}catch(e){Alert.alert('Error',e?.message||'Could not delete message.')}
  };

  const handleCopy=async()=>{
    if(!menuMessage?.text)return;
    try{await Clipboard.setStringAsync(menuMessage.text)}catch{}
    closeMenu();
  };

  const toggleFriend=id=>setSelectedFriends(x=>x.includes(id)?x.filter(v=>v!==id):[...x,id]);

  const openForward=()=>{
    if(!menuMessage)return;
    setSelectedFriends([]);closeMenu();setTimeout(()=>setShowForward(true),100);
  };

  const handleForward=async()=>{
    if(!menuMessage?.text)return;
    if(!selectedFriends.length){Alert.alert('Select friends','Choose at least one friend.');return}
    try{
      setSending(true);
      for(const id of selectedFriends)await sendMessage(meId,id,menuMessage.text);
      setShowForward(false);setSelectedFriends([]);setMenuMessage(null);
    }catch(e){Alert.alert('Forward failed',e?.message||'Could not forward message.')}
    finally{setSending(false)}
  };

  /* KEY FIX: keyboard is NEVER dismissed after sending */
  const handleSend=async()=>{
    const cleanText=text.trim();
    if(!cleanText||sending)return;
    const reply=replyingTo?{id:replyingTo.id,text:replyingTo.text,senderId:replyingTo.senderId,senderName:replyingTo.senderId===meId?'You':replyingTo.senderName||otherName||'Message'}:null;

    try{
      setSending(true);
      setText('');
      setReplyingTo(null);
      await sendMessage(meId,otherId,cleanText,reply);

      // Keep keyboard/input ready for the next message.
      requestAnimationFrame(()=>inputRef.current?.focus());
    }catch(e){
      setText(cleanText);
      Alert.alert('Send failed',e?.message||'Could not send message.');
    }finally{setSending(false)}
  };

  const friendList=Object.values(friendProfiles||{}).map(f=>{const id=f?.id||f?.uid;return{...f,id,uid:id}}).filter(f=>f.id&&f.id!==meId);

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={()=>navigation?.goBack()}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View style={styles.avatar}>{otherPhoto?<Image source={{uri:otherPhoto}} style={styles.avatarImage}/>:<Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>}</View>
        <View style={styles.headerInfo}><Text style={styles.headerName} numberOfLines={1}>{otherName}</Text><Text style={styles.headerStatus}>{otherProfile?.online?'Online':'Messages'}</Text></View>
      </View>

      {loading?<View style={styles.loading}><ActivityIndicator size="large" color={RED}/></View>:<FlatList
        inverted data={messages} keyExtractor={x=>x.id} contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        renderItem={({item})=><MessageRow item={item} showSeen={item.id===latestSeenMessageId} onLongPress={openMenu} onReply={handleReply} onReactionPress={handleReactionPress} inputRef={inputRef}/>}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.emptyText}>Start the conversation 👋</Text></View>}
      />}

      {replyingTo&&<View style={styles.replyComposer}>
        <View style={styles.replyComposerAccent}/>
        <View style={styles.replyComposerContent}><Text style={styles.replyComposerTitle}>Replying to {replyingTo.senderId===meId?'yourself':replyingTo.senderName||otherName||'message'}</Text><Text style={styles.replyComposerText} numberOfLines={2}>{String(replyingTo.text||'Message')}</Text></View>
        <TouchableOpacity onPress={()=>setReplyingTo(null)} style={styles.replyClose}><Text style={styles.replyCloseText}>×</Text></TouchableOpacity>
      </View>}

      <View style={styles.composer}>
        <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder="Message..." placeholderTextColor="#666" multiline maxLength={4000} style={styles.input}/>
        <TouchableOpacity style={[styles.sendButton,(!text.trim()||sending)&&styles.sendButtonDisabled]} onPress={handleSend} disabled={!text.trim()||sending} activeOpacity={.8}>
          {sending?<ActivityIndicator color="#fff"/>:<Text style={styles.sendText}>➤</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={!!menuMessage} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}/>
          <Animated.View style={[styles.actionSheet,{opacity:menuAnim,transform:[{translateY:menuAnim.interpolate({inputRange:[0,1],outputRange:[14,0]})},{scale:menuAnim.interpolate({inputRange:[0,1],outputRange:[.98,1]})}]}]}>
            <View style={styles.quickReactionRow}>
              {QUICK_REACTIONS.map(e=><TouchableOpacity key={e} style={styles.quickReaction} onPress={()=>handleReaction(e)}><Text style={styles.quickReactionText}>{e}</Text></TouchableOpacity>)}
              <TouchableOpacity style={[styles.quickReaction,styles.plusReaction]} onPress={()=>setShowExtraReactions(true)}><Text style={styles.plusReactionText}>+</Text></TouchableOpacity>
            </View>
            <View style={styles.menuDivider}/>
            <ActionButton icon="↩" label="Reply" onPress={()=>handleReply(menuMessage)}/>
            <ActionButton icon="➤" label="Forward" onPress={openForward}/>
            <ActionButton icon="⧉" label="Copy" onPress={handleCopy}/>
            {menuMessage?.senderId===meId&&!menuMessage?.unsent&&<ActionButton icon="↶" label="Unsend" danger onPress={handleUnsend}/>}
            <ActionButton icon="⌫" label="Delete for you" danger onPress={handleDeleteForMe}/>
            <ActionButton icon="×" label="Cancel" onPress={closeMenu}/>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showExtraReactions} transparent animationType="slide" onRequestClose={()=>setShowExtraReactions(false)}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={()=>setShowExtraReactions(false)}/>
          <View style={styles.reactionSheet}><View style={styles.sheetHandle}/><Text style={styles.sheetTitle}>Choose reaction</Text>
            <ScrollView contentContainerStyle={styles.emojiGrid}>{EXTRA_REACTIONS.map(e=><TouchableOpacity key={e} style={styles.bigEmojiButton} onPress={()=>handleReaction(e)}><Text style={styles.bigEmoji}>{e}</Text></TouchableOpacity>)}</ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!reactionMessage} transparent animationType="fade" onRequestClose={()=>{setReactionMessage(null);setReactionEmoji(null)}}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={()=>{setReactionMessage(null);setReactionEmoji(null)}}/>
          <View style={styles.reactionPopup}><Text style={styles.reactionPopupEmoji}>{reactionEmoji}</Text><Text style={styles.reactionPopupTitle}>Remove your reaction?</Text>
            <TouchableOpacity style={styles.redButton} onPress={removeMyReaction}><Text style={styles.redButtonText}>Remove</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={()=>{setReactionMessage(null);setReactionEmoji(null)}}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showForward} transparent animationType="slide" onRequestClose={()=>setShowForward(false)}>
        <View style={styles.modalBackdrop}><View style={styles.forwardSheet}><View style={styles.sheetHandle}/>
          <View style={styles.forwardHeader}><Text style={styles.sheetTitle}>Forward to</Text><TouchableOpacity onPress={()=>setShowForward(false)}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
          {friendList.length===0?<View style={styles.noFriends}><Text style={styles.noFriendsTitle}>No friends available</Text><Text style={styles.noFriendsText}>Your friend list is empty.</Text></View>:
          <ScrollView style={styles.friendScroll} contentContainerStyle={styles.friendList}>{friendList.map(f=>{
            const selected=selectedFriends.includes(f.id),photo=f.photoURL||f.photoUrl||f.profilePic||f.avatar||'',name=f.displayName||f.name||'User';
            return <TouchableOpacity key={f.id} style={styles.friendRow} onPress={()=>toggleFriend(f.id)}><View style={styles.friendAvatar}>{photo?<Image source={{uri:photo}} style={styles.friendAvatarImage}/>:<Text style={styles.friendAvatarText}>{name.charAt(0).toUpperCase()}</Text>}</View>
              <View style={styles.friendInfo}><Text style={styles.friendName} numberOfLines={1}>{name}</Text><Text style={styles.friendUsername}>{f.username?`@${f.username}`:'Friend'}</Text></View>
              <View style={[styles.checkbox,selected&&styles.checkboxSelected]}>{selected&&<Text style={styles.checkmark}>✓</Text>}</View>
            </TouchableOpacity>
          })}</ScrollView>}
          <TouchableOpacity style={[styles.forwardButton,(!selectedFriends.length||sending)&&styles.forwardButtonDisabled]} disabled={!selectedFriends.length||sending} onPress={handleForward}>
            {sending?<ActivityIndicator color="#fff"/>:<Text style={styles.forwardButtonText}>Forward{selectedFriends.length?` (${selectedFriends.length})`:''}</Text>}
          </TouchableOpacity>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function ActionButton({icon,label,onPress,danger=false}){
  return <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={.7}>
    <View style={[styles.actionIcon,danger&&styles.actionIconDanger]}><Text style={[styles.actionIconText,danger&&styles.actionIconTextDanger]}>{icon}</Text></View>
    <Text style={[styles.actionLabel,danger&&styles.actionLabelDanger]}>{label}</Text>
  </TouchableOpacity>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:BG},container:{flex:1,backgroundColor:BG},
  header:{height:64,flexDirection:'row',alignItems:'center',paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:BORDER,backgroundColor:'#0C0C0C'},
  backButton:{width:38,height:42,justifyContent:'center',alignItems:'center'},backText:{color:'#fff',fontSize:38,fontWeight:'300',marginTop:-4},
  avatar:{width:40,height:40,borderRadius:20,backgroundColor:RED,justifyContent:'center',alignItems:'center',overflow:'hidden'},avatarImage:{width:'100%',height:'100%'},avatarText:{color:'#fff',fontSize:17,fontWeight:'800'},
  headerInfo:{flex:1,minWidth:0,marginLeft:10},headerName:{color:TEXT,fontSize:16,fontWeight:'700'},headerStatus:{color:MUTED,fontSize:12,marginTop:2},
  loading:{flex:1,justifyContent:'center',alignItems:'center'},messagesList:{paddingHorizontal:12,paddingVertical:14},
  messageOuter:{width:'100%',marginVertical:4},messageAnimated:{flexGrow:0,flexShrink:1,maxWidth:'78%'},messageAnimatedMine:{alignSelf:'flex-end'},messageAnimatedOther:{alignSelf:'flex-start'},
  messageBubble:{alignSelf:'flex-start',borderRadius:18,paddingHorizontal:13,paddingVertical:9,minWidth:50,maxWidth:'100%',overflow:'hidden'},myBubble:{backgroundColor:RED,borderBottomRightRadius:5},otherBubble:{backgroundColor:CARD2,borderBottomLeftRadius:5,borderWidth:1,borderColor:BORDER},
  unsentBubble:{backgroundColor:'#444',opacity:.75},messageText:{color:'#fff',fontSize:15,lineHeight:21,flexShrink:1},unsentText:{color:'#D0D0D0',fontStyle:'italic'},unsentLabel:{color:'#AAA',fontSize:10,marginTop:3,fontStyle:'italic'},
  replyQuote:{alignSelf:'stretch',flexDirection:'row',backgroundColor:'#350B10',borderRadius:9,marginBottom:8,overflow:'hidden',borderWidth:1,borderColor:'#61151C'},replyAccent:{width:4,backgroundColor:RED},replyQuoteContent:{flex:1,minWidth:0,paddingHorizontal:10,paddingVertical:7},replyQuoteTitle:{color:'#FF5962',fontSize:11,fontWeight:'900',marginBottom:3},replyQuoteText:{color:'#D6A6AA',fontSize:12,lineHeight:17},
  reactionRow:{flexDirection:'row',marginTop:-4},reactionRowMine:{justifyContent:'flex-end'},reactionRowOther:{justifyContent:'flex-start'},reactionChip:{minHeight:27,paddingHorizontal:7,borderRadius:15,backgroundColor:'#202020',borderWidth:1,borderColor:'#333',flexDirection:'row',alignItems:'center',marginRight:4},reactionEmoji:{fontSize:15},reactionCount:{color:'#fff',fontSize:11,marginLeft:3,fontWeight:'700'},
  seenText:{color:'#777',fontSize:10,marginTop:3,marginHorizontal:4,alignSelf:'flex-end'},emptyContainer:{alignItems:'center',justifyContent:'center',paddingTop:250},emptyTitle:{color:'#fff',fontSize:18,fontWeight:'700'},emptyText:{color:'#777',marginTop:5},
  replyComposer:{minHeight:62,backgroundColor:'#101010',borderTopWidth:1,borderTopColor:BORDER,flexDirection:'row',alignItems:'center'},replyComposerAccent:{width:4,height:44,backgroundColor:RED},replyComposerContent:{flex:1,minWidth:0,paddingHorizontal:10,paddingVertical:7},replyComposerTitle:{color:RED,fontWeight:'800',fontSize:12},replyComposerText:{color:'#AAA',fontSize:12,lineHeight:17,marginTop:2},replyClose:{width:44,height:44,justifyContent:'center',alignItems:'center'},replyCloseText:{color:'#999',fontSize:27},
  composer:{minHeight:64,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'flex-end',backgroundColor:'#0C0C0C',borderTopWidth:1,borderTopColor:BORDER},input:{flex:1,maxHeight:120,minHeight:46,backgroundColor:'#171717',color:'#fff',borderRadius:23,paddingHorizontal:17,paddingTop:12,paddingBottom:10,fontSize:15,borderWidth:1,borderColor:BORDER},
  sendButton:{width:46,height:46,borderRadius:23,backgroundColor:RED,marginLeft:8,justifyContent:'center',alignItems:'center'},sendButtonDisabled:{opacity:.45},sendText:{color:'#fff',fontSize:20,fontWeight:'800'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.72)',justifyContent:'flex-end'},actionSheet:{backgroundColor:'#151515',borderTopLeftRadius:24,borderTopRightRadius:24,paddingTop:12,paddingBottom:16,paddingHorizontal:12},quickReactionRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',paddingVertical:5},quickReaction:{width:49,height:49,borderRadius:25,backgroundColor:'#222',justifyContent:'center',alignItems:'center',marginHorizontal:4,borderWidth:1,borderColor:'#333'},quickReactionText:{fontSize:25},plusReaction:{backgroundColor:RED,borderColor:RED},plusReactionText:{color:'#fff',fontSize:28},menuDivider:{height:1,backgroundColor:'#292929',marginVertical:8},
  actionButton:{minHeight:50,flexDirection:'row',alignItems:'center',paddingHorizontal:8,borderRadius:12},actionIcon:{width:36,height:36,borderRadius:18,backgroundColor:'#252525',justifyContent:'center',alignItems:'center',marginRight:12},actionIconDanger:{backgroundColor:'rgba(225,29,42,.16)'},actionIconText:{color:'#fff',fontSize:18},actionIconTextDanger:{color:RED},actionLabel:{color:'#fff',fontSize:15,fontWeight:'600'},actionLabelDanger:{color:RED},
  reactionSheet:{maxHeight:'70%',backgroundColor:'#151515',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:15,paddingTop:10,paddingBottom:25},sheetHandle:{width:42,height:4,borderRadius:3,backgroundColor:'#555',alignSelf:'center',marginBottom:13},sheetTitle:{color:'#fff',fontSize:18,fontWeight:'800',marginBottom:12},emojiGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center'},bigEmojiButton:{width:56,height:56,justifyContent:'center',alignItems:'center',borderRadius:12,backgroundColor:'#202020',margin:4},bigEmoji:{fontSize:28},
  reactionPopup:{alignSelf:'center',width:'84%',backgroundColor:'#161616',borderRadius:22,padding:22,alignItems:'center',borderWidth:1,borderColor:BORDER},reactionPopupEmoji:{fontSize:40,marginBottom:8},reactionPopupTitle:{color:'#fff',fontSize:16,fontWeight:'700',marginBottom:18},redButton:{width:'100%',minHeight:48,borderRadius:12,backgroundColor:RED,justifyContent:'center',alignItems:'center'},redButtonText:{color:'#fff',fontSize:15,fontWeight:'800'},cancelButton:{width:'100%',minHeight:48,justifyContent:'center',alignItems:'center',marginTop:4},cancelButtonText:{color:'#999',fontSize:14,fontWeight:'600'},
  forwardSheet:{maxHeight:'82%',backgroundColor:'#151515',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:15,paddingTop:10,paddingBottom:15},forwardHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},closeText:{color:'#999',fontSize:30},friendScroll:{maxHeight:440},friendList:{paddingVertical:5},friendRow:{minHeight:66,flexDirection:'row',alignItems:'center',paddingHorizontal:6,borderBottomWidth:1,borderBottomColor:'#222'},friendAvatar:{width:44,height:44,borderRadius:22,backgroundColor:RED,justifyContent:'center',alignItems:'center',overflow:'hidden'},friendAvatarImage:{width:'100%',height:'100%'},friendAvatarText:{color:'#fff',fontWeight:'800',fontSize:16},friendInfo:{flex:1,minWidth:0,marginLeft:11},friendName:{color:'#fff',fontSize:15,fontWeight:'700'},friendUsername:{color:'#777',fontSize:12,marginTop:2},checkbox:{width:25,height:25,borderRadius:13,borderWidth:2,borderColor:'#555',justifyContent:'center',alignItems:'center'},checkboxSelected:{backgroundColor:RED,borderColor:RED},checkmark:{color:'#fff',fontSize:16,fontWeight:'900'},forwardButton:{height:50,borderRadius:13,backgroundColor:RED,justifyContent:'center',alignItems:'center',marginTop:12},forwardButtonDisabled:{opacity:.4},forwardButtonText:{color:'#fff',fontSize:15,fontWeight:'800'},noFriends:{paddingVertical:50,alignItems:'center'},noFriendsTitle:{color:'#fff',fontSize:16,fontWeight:'700'},noFriendsText:{color:'#777',marginTop:5}
});