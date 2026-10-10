import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
}from'react-native';

import*as Clipboard from'expo-clipboard';
import*as Haptics from'expo-haptics';
import{FontAwesome}from'@expo/vector-icons';

import{
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query
}from'firebase/firestore';

import{db}from'../config/firebase';
import{sendPushNotification}from'../services/notifications';
import{uploadFile}from'../services/media';
import VoiceRecorderBar from'../components/VoiceRecorderBar';
import VoiceMessageBubble from'../components/VoiceMessageBubble';
import SharedLinkCard,{parseSharedLink}from'../components/SharedLinkCard';

import{
  chatIdFor,
  deleteMessageForMe,
  markChatRead,
  markMessagesSeen,
  reactToMessage,
  removeReaction,
  sendMessage,
  sendVoiceMessage,
  setTyping,
  unsendMessage
}from'../services/chat';


const RED='#E11D2A';
const BG='#080808';
const CARD='#171717';
const BORDER='#292929';
const TEXT='#FFF';
const MUTED='#8F8F8F';

const QUICK=['❤️','😂','😅','😢','🔥','👍'];

const EXTRA=[
  '👎','👏','🙌','😍','🥰','😘','🤣','😎','🤔','😮',
  '😱','😡','😭','🥹','🤗','😴','🤩','💀','🤝','🙏',
  '💯','✨','🎉','💔','❤️‍🔥','🫶','👀','🚀','😈','🍌'
];


function millis(v){
  try{
    if(!v)return 0;

    if(typeof v.toMillis==='function'){
      return v.toMillis();
    }

    if(typeof v.toDate==='function'){
      return v.toDate().getTime();
    }

    if(v instanceof Date){
      return v.getTime();
    }

    const n=new Date(v).getTime();

    return Number.isNaN(n)?0:n;
  }catch{
    return 0;
  }
}


function seenTime(v){
  const m=millis(v);

  if(!m)return'Seen just now';

  const d=Math.max(0,Date.now()-m);

  if(d<60000)return'Seen just now';

  if(d<3600000){
    return`Seen ${Math.floor(d/60000)}m ago`;
  }

  if(d<86400000){
    return`Seen ${Math.floor(d/3600000)}h ago`;
  }

  return`Seen ${new Date(m).toLocaleDateString()}`;
}


/*
  Different versions of chat data can sometimes store the
  replied message text under slightly different keys.

  This helper makes the UI tolerant of all of them.
*/
function getReplyText(reply){
  if(!reply)return'';

  return String(
    reply.text ??
    reply.message ??
    reply.content ??
    reply.body ??
    ''
  );
}


function getReplySenderId(reply){
  if(!reply)return null;

  return(
    reply.senderId ??
    reply.uid ??
    reply.userId ??
    null
  );
}


function getReplySenderName(reply){
  if(!reply)return'';

  return(
    reply.senderName ??
    reply.name ??
    reply.displayName ??
    ''
  );
}


/* =========================================================
   MESSAGE ROW
   ========================================================= */

function MessageRow({
  item,
  showSeen,
  onLongPress,
  onReply,
  onReactionPress,
  inputRef
}){
  const mine=item.senderId===item._meId;

  const x=useRef(new Animated.Value(0)).current;
  const scale=useRef(new Animated.Value(1)).current;

  const long=useRef(false);

  /*
    IMPORTANT SWIPE RULE:

    Friend message:
      LEFT -> RIGHT
      dx > 0

    Your message:
      RIGHT -> LEFT
      dx < 0
  */

  const allowedDirection=mine?'left':'right';

  const shouldSwipe=(dx,dy)=>{
    if(Math.abs(dx)<8)return false;

    if(Math.abs(dx)<=Math.abs(dy)+5)return false;

    if(allowedDirection==='left'){
      return dx<0;
    }

    return dx>0;
  };


  // keep the latest message/callback without rebuilding the gesture
  const itemRef=useRef(item);
  itemRef.current=item;
  const onReplyRef=useRef(onReply);
  onReplyRef.current=onReply;

  // built once per row (not on every render), so a re-render in the middle of a
  // swipe can no longer reset the gesture
  const replySwipe=useMemo(()=>PanResponder.create({

    onStartShouldSetPanResponder:()=>false,

    onMoveShouldSetPanResponderCapture:(_,g)=>{
      return shouldSwipe(g.dx,g.dy);
    },

    onMoveShouldSetPanResponder:(_,g)=>{
      return shouldSwipe(g.dx,g.dy);
    },

    onPanResponderTerminationRequest:()=>false,

    onShouldBlockNativeResponder:()=>true,


    onPanResponderMove:(_,g)=>{

      if(mine){

        /*
          Your message:
          only allow RIGHT -> LEFT
        */

        if(g.dx<0){
          x.setValue(Math.max(g.dx,-90));
        }

      }else{

        /*
          Friend message:
          only allow LEFT -> RIGHT
        */

        if(g.dx>0){
          x.setValue(Math.min(g.dx,90));
        }
      }
    },


    onPanResponderRelease:(_,g)=>{

      const shouldReply=mine
        ?g.dx<=-55
        :g.dx>=55;

      Animated.spring(x,{
        toValue:0,
        speed:30,
        bounciness:4,
        useNativeDriver:true
      }).start();

      if(shouldReply){

        onReplyRef.current(itemRef.current);

        requestAnimationFrame(()=>{
          inputRef?.current?.focus();
        });
      }
    },


    onPanResponderTerminate:()=>{

      Animated.spring(x,{
        toValue:0,
        speed:30,
        bounciness:4,
        useNativeDriver:true
      }).start();
    }
  }),[mine]);


  const longPress=async()=>{

    if(long.current)return;

    long.current=true;

    try{
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      );
    }catch{}

    // the "press" effect only happens on tap-and-hold (reaction menu)
    Animated.sequence([
      Animated.timing(scale,{
        toValue:.96,
        duration:90,
        useNativeDriver:true
      }),
      Animated.spring(scale,{
        toValue:1,
        speed:30,
        bounciness:6,
        useNativeDriver:true
      })
    ]).start();

    onLongPress(item);

    setTimeout(()=>{
      long.current=false;
    },250);
  };


  const counts={};

  Object.values(item.reactions||{}).forEach(e=>{
    if(e){
      counts[e]=(counts[e]||0)+1;
    }
  });


  const hasReply=
    !!item.replyTo &&
    !item.unsent;


  const replySenderId=getReplySenderId(item.replyTo);

  const replyName=
    replySenderId===item._meId
      ?'You'
      :getReplySenderName(item.replyTo)||'Message';


  const replyText=getReplyText(item.replyTo);


  return(
    <View
      style={[
        styles.messageOuter,
        {
          alignItems:mine
            ?'flex-end'
            :'flex-start'
        }
      ]}
    >

      <Animated.View
        {...replySwipe.panHandlers}
        style={[
          styles.messageAnimated,
          {
            alignSelf:mine
              ?'flex-end'
              :'flex-start',

            transform:[
              {translateX:x},
              {scale}
            ]
          }
        ]}
      >

        <Pressable
          onLongPress={longPress}
          delayLongPress={300}
          style={[
            styles.messageBubble,

            mine
              ?styles.myBubble
              :styles.otherBubble,

            item.unsent&&styles.unsentBubble,

            // a short reply must still be wide enough to show the quoted message
            hasReply&&styles.replyBubble
          ]}
        >

          {/* ================= REPLY PREVIEW ================= */}

          {hasReply&&(
            <View style={styles.replyQuote}>

              <View style={styles.replyAccent}/>

              <View style={styles.replyQuoteContent}>

                <Text
                  style={styles.replyQuoteTitle}
                  numberOfLines={1}
                >
                  {replyName}
                </Text>

                <Text
                  style={styles.replyQuoteText}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {replyText||'Message'}
                </Text>

              </View>

            </View>
          )}


          {/* ================= MESSAGE TEXT ================= */}

          {item.type==='audio'&&item.audioUrl&&!item.unsent
            ?(
              <VoiceMessageBubble
                url={item.audioUrl}
                duration={item.duration||0}
              />
            )
            :(
              (()=>{
                const link=item.unsent
                  ?null
                  :parseSharedLink(item.text);

                if(link){
                  return <SharedLinkCard link={link}/>;
                }

                return(
                  <Text
                    style={[
                      styles.messageText,
                      item.unsent&&styles.unsentText
                    ]}
                  >
                    {String(item.text||'')}
                  </Text>
                );
              })()
            )
          }


          {item.unsent&&(
            <Text style={styles.unsentLabel}>
              Unsent message
            </Text>
          )}

        </Pressable>


        {/* ================= REACTIONS ================= */}

        {Object.keys(counts).length>0&&(
          <View
            style={[
              styles.reactionRow,
              {
                justifyContent:mine
                  ?'flex-end'
                  :'flex-start'
              }
            ]}
          >
            {Object.entries(counts).map(([e,c])=>(
              <TouchableOpacity
                key={e}
                style={styles.reactionChip}
                onPress={()=>onReactionPress(item,e)}
              >
                <Text style={styles.reactionEmoji}>
                  {e}
                </Text>

                {c>1&&(
                  <Text style={styles.reactionCount}>
                    {c}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

      </Animated.View>


      {showSeen&&(
        <Text style={styles.seenText}>
          {seenTime(item.seenBy?.[item._otherId])}
        </Text>
      )}

    </View>
  );
}


/* =========================================================
   CHAT SCREEN
   ========================================================= */

export default function ChatScreen({
  route,
  navigation
}){

  const{
    user,
    otherUser,
    friendProfiles={}
  }=route.params||{};


  const me=user||{};
  const other=otherUser||{};


  const meId=
    me.id||
    me.uid||
    null;


  const otherId=
    other.id||
    other.uid||
    null;


  const chatId=
    chatIdFor(
      meId,
      otherId
    );


  const profile=
    friendProfiles?.[otherId]||
    other;


  const photo=
    profile?.photoURL||
    profile?.photoUrl||
    profile?.profilePic||
    profile?.avatar||
    '';


  const name=
    profile?.displayName||
    profile?.name||
    'User';


  const[
    messages,
    setMessages
  ]=useState([]);


  const[
    loading,
    setLoading
  ]=useState(true);


  const[
    text,
    setText
  ]=useState('');


  const[
    replyingTo,
    setReplyingTo
  ]=useState(null);


  const[
    menuMessage,
    setMenuMessage
  ]=useState(null);


  const[
    reactionMessage,
    setReactionMessage
  ]=useState(null);


  const[
    reactionEmoji,
    setReactionEmoji
  ]=useState(null);


  const[
    extra,
    setExtra
  ]=useState(false);


  const[
    forward,
    setForward
  ]=useState(false);


  const[
    selected,
    setSelected
  ]=useState([]);


  const[
    sending,
    setSending
  ]=useState(false);


  const inputRef=useRef(null);

  const menuAnim=
    useRef(
      new Animated.Value(0)
    ).current;


  /* =========================================================
     VOICE MESSAGES
     ========================================================= */

  const[recordingVoice,setRecordingVoice]=useState(false);

  const sendVoice=async(uri,duration)=>{
    try{
      const url=await uploadFile(
        uri,
        `voice/${chatId}/${Date.now()}.m4a`,
        'audio/m4a'
      );

      await sendVoiceMessage(meId,otherId,url,duration);

      sendPushNotification({
        toUserId:otherId,
        title:me.name||'New message',
        body:'Voice message',
        data:{
          type:'message',
          fromId:meId,
          fromName:me.name||'',
          fromPhoto:me.photoURL||''
        }
      }).catch(()=>{});
    }catch(e){
      Alert.alert(
        'Voice message failed',
        e?.message||'Could not send the voice message.'
      );
    }finally{
      setRecordingVoice(false);
    }
  };


  /* =========================================================
     TYPING INDICATOR
     ========================================================= */

  const[otherTyping,setOtherTyping]=useState(false);
  const typingActiveRef=useRef(false);
  const typingTimerRef=useRef(null);

  const stopTyping=()=>{
    clearTimeout(typingTimerRef.current);
    if(typingActiveRef.current){
      typingActiveRef.current=false;
      setTyping(chatId,meId,false).catch(()=>{});
    }
  };

  const handleTextChange=(value)=>{
    setText(value);
    if(!meId||!otherId)return;
    if(!value.trim()){
      stopTyping();
      return;
    }
    if(!typingActiveRef.current){
      typingActiveRef.current=true;
      setTyping(chatId,meId,true).catch(()=>{});
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current=setTimeout(stopTyping,2500);
  };

  // stop typing when leaving the chat
  useEffect(()=>()=>{
    clearTimeout(typingTimerRef.current);
    if(typingActiveRef.current&&chatId&&meId){
      setTyping(chatId,meId,false).catch(()=>{});
    }
  },[chatId,meId]);

  // watch whether the other person is typing
  useEffect(()=>{
    if(!chatId||!otherId)return undefined;
    return onSnapshot(
      doc(db,'chats',chatId),
      snap=>setOtherTyping(!!snap.data()?.typing?.[otherId]),
      ()=>{}
    );
  },[chatId,otherId]);


  /* =========================================================
     FIRESTORE LISTENER
     ========================================================= */

  useEffect(()=>{

    if(!meId||!otherId){

      setLoading(false);

      return;
    }


    const q=query(
      collection(
        db,
        'chats',
        chatId,
        'messages'
      ),
      orderBy(
        'createdAt',
        'desc'
      ),
      limit(80)
    );


    return onSnapshot(
      q,

      async snap=>{

        const data=
          snap.docs
            .map(d=>({
              id:d.id,
              ...d.data()
            }))
            .filter(
              m=>!(m.deletedFor||[])
                .includes(meId)
            );


        const mapped=
          data.map(m=>({
            ...m,
            _meId:meId,
            _otherId:otherId
          }));


        setMessages(mapped);
        setLoading(false);


        try{

          await markChatRead(
            chatId,
            meId
          );

          await markMessagesSeen(
            chatId,
            mapped,
            meId
          );

        }catch(e){

          console.log(
            'Read/seen:',
            e?.message||e
          );
        }

      },

      e=>{

        console.log(
          'Messages:',
          e?.message||e
        );

        setLoading(false);
      }
    );

  },[
    chatId,
    meId,
    otherId
  ]);


  /* =========================================================
     LATEST SEEN
     ========================================================= */

  const latestSeen=useMemo(
    ()=>messages.find(
      m=>
        m.senderId===meId&&
        m.seenBy?.[otherId]
    )?.id||null,
    [
      messages,
      meId,
      otherId
    ]
  );


  /* =========================================================
     MENU
     ========================================================= */

  const closeMenu=useCallback(
    ()=>{

      Animated.timing(
        menuAnim,
        {
          toValue:0,
          duration:80,
          useNativeDriver:true
        }
      ).start(
        ()=>setMenuMessage(null)
      );

    },
    [menuAnim]
  );


  const openMenu=useCallback(
    m=>{

      setMenuMessage(m);

      menuAnim.setValue(0);

      requestAnimationFrame(()=>{
        Animated.timing(
          menuAnim,
          {
            toValue:1,
            duration:100,
            useNativeDriver:true
          }
        ).start();
      });

    },
    [menuAnim]
  );


  /* =========================================================
     REPLY
     ========================================================= */

  const handleReply=useCallback(
    m=>{

      if(!m||m.unsent)return;

      setReplyingTo(m);

      closeMenu();

      requestAnimationFrame(()=>{
        inputRef.current?.focus();
      });

    },
    [closeMenu]
  );


  /* =========================================================
     REACTION
     ========================================================= */

  const react=async e=>{

    if(!menuMessage?.id)return;

    try{

      await reactToMessage(
        chatId,
        menuMessage.id,
        meId,
        e
      );

      setExtra(false);

      closeMenu();

    }catch(err){

      Alert.alert(
        'Reaction failed',
        err?.message||
        'Unable to react.'
      );
    }
  };


  const reactionPress=(m,e)=>{

    if(
      m.reactions?.[meId]===e
    ){

      setReactionMessage(m);
      setReactionEmoji(e);

    }else{

      setMenuMessage(m);

      menuAnim.setValue(0);

      requestAnimationFrame(()=>{
        Animated.timing(
          menuAnim,
          {
            toValue:1,
            duration:100,
            useNativeDriver:true
          }
        ).start();
      });
    }
  };


  const removeReact=async()=>{

    if(!reactionMessage?.id)return;

    try{

      await removeReaction(
        chatId,
        reactionMessage.id,
        meId
      );

    }catch(e){

      Alert.alert(
        'Error',
        e?.message||
        'Could not remove reaction.'
      );
    }

    setReactionMessage(null);
    setReactionEmoji(null);
  };


  /* =========================================================
     UNSEND / DELETE / COPY
     ========================================================= */

  const unsend=async()=>{

    if(!menuMessage?.id)return;

    closeMenu();

    try{

      await unsendMessage(
        chatId,
        menuMessage.id,
        meId
      );

    }catch(e){

      Alert.alert(
        'Error',
        e?.message||
        'Could not unsend message.'
      );
    }
  };


  const deleteForMe=async()=>{

    if(!menuMessage?.id)return;

    closeMenu();

    try{

      await deleteMessageForMe(
        chatId,
        menuMessage.id,
        meId
      );

    }catch(e){

      Alert.alert(
        'Error',
        e?.message||
        'Could not delete message.'
      );
    }
  };


  const copy=async()=>{

    if(menuMessage?.text){

      try{

        await Clipboard.setStringAsync(
          menuMessage.text
        );

      }catch{}
    }

    closeMenu();
  };


  /* =========================================================
     FORWARD
     ========================================================= */

  const toggleFriend=id=>
    setSelected(
      x=>
        x.includes(id)
          ?x.filter(v=>v!==id)
          :[...x,id]
    );


  const openForward=()=>{

    if(!menuMessage)return;

    setSelected([]);

    closeMenu();

    setTimeout(
      ()=>setForward(true),
      100
    );
  };


  const doForward=async()=>{

    if(!menuMessage?.text)return;

    if(!selected.length){

      Alert.alert(
        'Select friends',
        'Choose at least one friend.'
      );

      return;
    }


    try{

      setSending(true);

      for(const id of selected){

        await sendMessage(
          meId,
          id,
          menuMessage.text
        );
      }


      setForward(false);
      setSelected([]);
      setMenuMessage(null);

    }catch(e){

      Alert.alert(
        'Forward failed',
        e?.message||
        'Could not forward message.'
      );

    }finally{

      setSending(false);
    }
  };


  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  const send=async()=>{

    const clean=text.trim();

    if(!clean||sending)return;


    const reply=replyingTo
      ?{
          id:replyingTo.id,

          text:getReplyText(
            replyingTo
          ),

          senderId:
            replyingTo.senderId,

          senderName:
            replyingTo.senderId===meId
              ?'You'
              :replyingTo.senderName||
                name||
                'Message'
        }
      :null;


    setText('');
    stopTyping();

    setReplyingTo(null);

    setSending(true);


    try{

      await sendMessage(
        meId,
        otherId,
        clean,
        reply
      );

      // Push notification for the receiver (never blocks or fails the send)
      sendPushNotification({
        toUserId:otherId,
        title:me.name||'New message',
        body:clean,
        data:{
          type:'message',
          fromId:meId,
          fromName:me.name||'',
          fromPhoto:me.photoURL||''
        }
      }).catch(()=>{});


      requestAnimationFrame(()=>{
        inputRef.current?.focus();
      });

    }catch(e){

      setText(clean);

      Alert.alert(
        'Send failed',
        e?.message||
        'Could not send message.'
      );

      requestAnimationFrame(()=>{
        inputRef.current?.focus();
      });

    }finally{

      setSending(false);
    }
  };


  /* =========================================================
     FRIENDS
     ========================================================= */

  const friends=
    Object.values(
      friendProfiles||{}
    )
    .map(f=>{

      const id=
        f?.id||
        f?.uid;

      return{
        ...f,
        id
      };

    })
    .filter(
      f=>
        f.id&&
        f.id!==meId
    );


  /* =========================================================
     UI
     ========================================================= */

  return(
    <SafeAreaView style={styles.safe}>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS==='ios'
            ?'padding'
            :undefined
        }
      >

        {/* ================= HEADER ================= */}

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={()=>
              navigation?.goBack()
            }
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </TouchableOpacity>


          <View style={styles.avatar}>

            {photo
              ?(
                <Image
                  source={{uri:photo}}
                  style={styles.avatarImage}
                />
              )
              :(
                <Text style={styles.avatarText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              )
            }

          </View>


          <View style={styles.headerInfo}>

            <Text style={styles.headerName}>
              {name}
            </Text>

            <Text style={[styles.headerStatus,otherTyping&&{color:'#22C55E'}]}>
              {otherTyping
                ?'typing...'
                :profile?.online
                  ?'Online'
                  :'Messages'
              }
            </Text>

          </View>

        </View>


        {/* ================= MESSAGES ================= */}

        {loading

          ?(
            <View style={styles.loading}>
              <ActivityIndicator
                size="large"
                color={RED}
              />
            </View>
          )

          :(
            <FlatList
              inverted
              data={messages}
              keyExtractor={x=>x.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.messagesList
              }

              renderItem={({item})=>(
                <MessageRow
                  item={item}
                  showSeen={
                    item.id===latestSeen
                  }
                  onLongPress={openMenu}
                  onReply={handleReply}
                  onReactionPress={
                    reactionPress
                  }
                  inputRef={inputRef}
                />
              )}

              ListEmptyComponent={
                <View style={styles.empty}>

                  <Text style={styles.emptyTitle}>
                    No messages yet
                  </Text>

                  <Text style={styles.emptyText}>
                    Start the conversation 👋
                  </Text>

                </View>
              }
            />
          )
        }


        {/* ================= REPLY COMPOSER ================= */}

        {replyingTo&&(

          <View style={styles.replyComposer}>

            <View
              style={
                styles.replyComposerAccent
              }
            />

            <View
              style={
                styles.replyComposerContent
              }
            >

              <Text
                style={
                  styles.replyComposerTitle
                }
              >
                Replying to{' '}
                {
                  replyingTo.senderId===meId
                    ?'yourself'
                    :replyingTo.senderName||
                      name
                }
              </Text>

              <Text
                style={
                  styles.replyComposerText
                }
                numberOfLines={2}
              >
                {getReplyText(
                  replyingTo
                )||'Message'}
              </Text>

            </View>


            <TouchableOpacity
              onPress={()=>
                setReplyingTo(null)
              }
              style={styles.replyClose}
            >
              <Text style={styles.replyCloseText}>
                ×
              </Text>
            </TouchableOpacity>

          </View>
        )}


        {/* ================= COMPOSER ================= */}

        {recordingVoice
          ?(
            <VoiceRecorderBar
              onCancel={()=>setRecordingVoice(false)}
              onSend={sendVoice}
            />
          )
          :(
        <View style={styles.composer}>

          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message..."
            placeholderTextColor="#666"
            multiline
            maxLength={4000}
            style={styles.input}
          />


          <TouchableOpacity
            style={[
              styles.sendButton,
              !!text.trim()&&
              sending&&
              styles.disabled
            ]}
            disabled={sending}
            onPress={text.trim()?send:()=>setRecordingVoice(true)}
          >

            {sending

              ?(
                <ActivityIndicator
                  color="#fff"
                />
              )

              :(
                text.trim()
                  ?(
                    <Text style={styles.sendText}>
                      ➤
                    </Text>
                  )
                  :(
                    <FontAwesome
                      name="microphone"
                      size={22}
                      color="#fff"
                    />
                  )
              )
            }

          </TouchableOpacity>

        </View>
          )
        }


        {/* ================= ACTION MENU ================= */}

        <Modal
          visible={!!menuMessage}
          transparent
          animationType="none"
          onRequestClose={closeMenu}
        >

          <View style={styles.backdrop}>

            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeMenu}
            />


            <Animated.View
              style={[
                styles.actionSheet,
                {
                  opacity:menuAnim,

                  transform:[
                    {
                      translateY:
                        menuAnim.interpolate({
                          inputRange:[0,1],
                          outputRange:[12,0]
                        })
                    },
                    {
                      scale:
                        menuAnim.interpolate({
                          inputRange:[0,1],
                          outputRange:[.98,1]
                        })
                    }
                  ]
                }
              ]}
            >

              <View style={styles.quickRow}>

                {QUICK.map(e=>(

                  <TouchableOpacity
                    key={e}
                    style={styles.quick}
                    onPress={()=>react(e)}
                  >
                    <Text style={styles.quickText}>
                      {e}
                    </Text>
                  </TouchableOpacity>

                ))}


                <TouchableOpacity
                  style={[
                    styles.quick,
                    styles.plus
                  ]}
                  onPress={()=>
                    setExtra(true)
                  }
                >
                  <Text style={styles.plusText}>
                    +
                  </Text>
                </TouchableOpacity>

              </View>


              <View style={styles.divider}/>


              <ActionButton
                icon="↩"
                label="Reply"
                onPress={()=>
                  handleReply(menuMessage)
                }
              />


              <ActionButton
                icon="➤"
                label="Forward"
                onPress={openForward}
              />


              <ActionButton
                icon="⧉"
                label="Copy"
                onPress={copy}
              />


              {menuMessage?.senderId===meId&&
                !menuMessage?.unsent&&(

                <ActionButton
                  icon="↶"
                  label="Unsend"
                  danger
                  onPress={unsend}
                />

              )}


              <ActionButton
                icon="⌫"
                label="Delete for you"
                danger
                onPress={deleteForMe}
              />


              <ActionButton
                icon="×"
                label="Cancel"
                onPress={closeMenu}
              />

            </Animated.View>

          </View>

        </Modal>


        {/* ================= EXTRA REACTIONS ================= */}

        <Modal
          visible={extra}
          transparent
          animationType="slide"
          onRequestClose={()=>
            setExtra(false)
          }
        >

          <View style={styles.backdrop}>

            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={()=>
                setExtra(false)
              }
            />


            <View style={styles.sheet}>

              <View style={styles.handle}/>

              <Text style={styles.sheetTitle}>
                Choose reaction
              </Text>


              <ScrollView
                contentContainerStyle={
                  styles.grid
                }
              >

                {EXTRA.map(e=>(

                  <TouchableOpacity
                    key={e}
                    style={styles.emojiButton}
                    onPress={()=>
                      react(e)
                    }
                  >

                    <Text style={styles.bigEmoji}>
                      {e}
                    </Text>

                  </TouchableOpacity>

                ))}

              </ScrollView>

            </View>

          </View>

        </Modal>


        {/* ================= REMOVE REACTION ================= */}

        <Modal
          visible={!!reactionMessage}
          transparent
          animationType="fade"
        >

          <View style={styles.backdrop}>

            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={()=>{
                setReactionMessage(null);
                setReactionEmoji(null);
              }}
            />


            <View style={styles.popup}>

              <Text style={styles.popupEmoji}>
                {reactionEmoji}
              </Text>

              <Text style={styles.popupTitle}>
                Remove your reaction?
              </Text>


              <TouchableOpacity
                style={styles.redButton}
                onPress={removeReact}
              >
                <Text style={styles.redButtonText}>
                  Remove
                </Text>
              </TouchableOpacity>


              <TouchableOpacity
                style={styles.cancelButton}
                onPress={()=>{
                  setReactionMessage(null);
                  setReactionEmoji(null);
                }}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </Modal>


        {/* ================= FORWARD ================= */}

        <Modal
          visible={forward}
          transparent
          animationType="slide"
          onRequestClose={()=>
            setForward(false)
          }
        >

          <View style={styles.backdrop}>

            <View style={styles.forwardSheet}>

              <View style={styles.handle}/>


              <View style={styles.forwardHeader}>

                <Text style={styles.sheetTitle}>
                  Forward to
                </Text>

                <TouchableOpacity
                  onPress={()=>
                    setForward(false)
                  }
                >
                  <Text style={styles.close}>
                    ×
                  </Text>
                </TouchableOpacity>

              </View>


              {!friends.length

                ?(
                  <View style={styles.noFriends}>
                    <Text style={styles.noFriendsTitle}>
                      No friends available
                    </Text>
                  </View>
                )

                :(
                  <ScrollView
                    style={styles.friendScroll}
                  >

                    {friends.map(f=>{

                      const chosen=
                        selected.includes(f.id);

                      const fp=
                        f.photoURL||
                        f.photoUrl||
                        f.profilePic||
                        f.avatar||
                        '';

                      const fn=
                        f.displayName||
                        f.name||
                        'User';


                      return(
                        <TouchableOpacity
                          key={f.id}
                          style={styles.friendRow}
                          onPress={()=>
                            toggleFriend(f.id)
                          }
                        >

                          <View
                            style={
                              styles.friendAvatar
                            }
                          >

                            {fp

                              ?(
                                <Image
                                  source={{uri:fp}}
                                  style={
                                    styles.friendAvatarImage
                                  }
                                />
                              )

                              :(
                                <Text
                                  style={
                                    styles.friendAvatarText
                                  }
                                >
                                  {fn.charAt(0).toUpperCase()}
                                </Text>
                              )
                            }

                          </View>


                          <View
                            style={
                              styles.friendInfo
                            }
                          >

                            <Text
                              style={
                                styles.friendName
                              }
                            >
                              {fn}
                            </Text>

                            <Text
                              style={
                                styles.friendUsername
                              }
                            >
                              {
                                f.username
                                  ?`@${f.username}`
                                  :'Friend'
                              }
                            </Text>

                          </View>


                          <View
                            style={[
                              styles.checkbox,
                              chosen&&
                                styles.checkboxSelected
                            ]}
                          >
                            {chosen&&(
                              <Text
                                style={
                                  styles.checkmark
                                }
                              >
                                ✓
                              </Text>
                            )}
                          </View>

                        </TouchableOpacity>
                      );

                    })}

                  </ScrollView>
                )
              }


              <TouchableOpacity
                style={[
                  styles.forwardButton,
                  (
                    !selected.length||
                    sending
                  )&&styles.disabled
                ]}
                disabled={
                  !selected.length||
                  sending
                }
                onPress={doForward}
              >

                {sending

                  ?(
                    <ActivityIndicator
                      color="#fff"
                    />
                  )

                  :(
                    <Text style={styles.forwardText}>
                      Forward
                      {
                        selected.length
                          ?` (${selected.length})`
                          :''
                      }
                    </Text>
                  )
                }

              </TouchableOpacity>

            </View>

          </View>

        </Modal>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}


/* =========================================================
   ACTION BUTTON
   ========================================================= */

function ActionButton({
  icon,
  label,
  onPress,
  danger=false
}){

  return(
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
    >

      <View
        style={[
          styles.actionIcon,
          danger&&styles.dangerIcon
        ]}
      >

        <Text
          style={[
            styles.actionIconText,
            danger&&styles.dangerText
          ]}
        >
          {icon}
        </Text>

      </View>


      <Text
        style={[
          styles.actionLabel,
          danger&&styles.dangerText
        ]}
      >
        {label}
      </Text>

    </TouchableOpacity>
  );
}


/* =========================================================
   STYLES
   ========================================================= */

const styles=StyleSheet.create({

  safe:{
    flex:1,
    backgroundColor:BG
  },

  container:{
    flex:1,
    backgroundColor:BG
  },


  /* HEADER */

  header:{
    height:64,
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:14,
    borderBottomWidth:1,
    borderBottomColor:BORDER,
    backgroundColor:'#0C0C0C'
  },

  backButton:{
    width:38,
    height:42,
    justifyContent:'center',
    alignItems:'center'
  },

  backText:{
    color:'#fff',
    fontSize:38,
    fontWeight:'300'
  },

  avatar:{
    width:40,
    height:40,
    borderRadius:20,
    backgroundColor:RED,
    justifyContent:'center',
    alignItems:'center',
    overflow:'hidden'
  },

  avatarImage:{
    width:'100%',
    height:'100%'
  },

  avatarText:{
    color:'#fff',
    fontSize:17,
    fontWeight:'800'
  },

  headerInfo:{
    flex:1,
    marginLeft:10
  },

  headerName:{
    color:TEXT,
    fontSize:16,
    fontWeight:'700'
  },

  headerStatus:{
    color:MUTED,
    fontSize:12,
    marginTop:2
  },


  /* LOADING */

  loading:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  },


  /* MESSAGE LIST */

  messagesList:{
    paddingHorizontal:12,
    paddingVertical:14
  },

  messageOuter:{
    width:'100%',
    marginVertical:4,

    /*
      Prevent children from forcing the row wider.
    */
    overflow:'visible'
  },


  /*
    IMPORTANT:
    Do not give this a fixed width.

    The bubble naturally sizes to its content,
    while maxWidth prevents it from becoming
    wider than the screen.
  */

  messageAnimated:{
    maxWidth:'78%',
    flexShrink:1,
    minWidth:0
  },


  messageBubble:{
    maxWidth:'100%',
    minWidth:50,

    borderRadius:18,

    paddingHorizontal:13,
    paddingVertical:9,

    /*
      Critical for long messages.
    */
    alignSelf:'stretch'
  },

  myBubble:{
    backgroundColor:RED,
    borderBottomRightRadius:5
  },

  otherBubble:{
    backgroundColor:CARD,
    borderBottomLeftRadius:5,
    borderWidth:1,
    borderColor:BORDER
  },

  replyBubble:{
    minWidth:230
  },

  unsentBubble:{
    backgroundColor:'#444',
    opacity:.75
  },


  /*
    Critical fix:
    Text is now allowed to shrink/wrap instead
    of pushing outside the bubble.
  */

  messageText:{
    color:'#fff',
    fontSize:15,
    lineHeight:21,
    flexShrink:1,
    maxWidth:'100%'
  },

  unsentText:{
    color:'#D0D0D0',
    fontStyle:'italic'
  },

  unsentLabel:{
    color:'#AAA',
    fontSize:10,
    marginTop:3,
    fontStyle:'italic'
  },


  /* =====================================================
     REPLY QUOTE

     This is the important fix for the screenshot.

     The previous version used a flex child inside an
     auto-sized row which could cause the reply block
     to stretch vertically / become huge.

     Now the quote is explicitly constrained.
     ===================================================== */

  replyQuote:{
    width:'100%',

    minHeight:42,
    maxHeight:84,

    flexDirection:'row',

    backgroundColor:'#350B10',

    borderRadius:8,

    marginBottom:8,

    borderWidth:1,
    borderColor:'#61151C',

    overflow:'hidden',

    alignSelf:'stretch'
  },

  replyAccent:{
    width:4,
    flexShrink:0,
    backgroundColor:RED
  },

  replyQuoteContent:{
    flex:1,
    flexGrow:1,
    flexShrink:1,

    minWidth:0,

    paddingHorizontal:9,
    paddingVertical:6,

    justifyContent:'center'
  },

  replyQuoteTitle:{
    color:'#FF5962',
    fontSize:11,
    lineHeight:14,
    fontWeight:'900',
    marginBottom:2,
    flexShrink:1
  },

  replyQuoteText:{
    color:'#D6A6AA',
    fontSize:12,
    lineHeight:16,

    flexShrink:1,

    maxWidth:'100%'
  },


  /* REACTIONS */

  reactionRow:{
    flexDirection:'row',
    marginTop:-4
  },

  reactionChip:{
    minHeight:27,
    paddingHorizontal:7,
    borderRadius:15,
    backgroundColor:'#202020',
    borderWidth:1,
    borderColor:'#333',
    flexDirection:'row',
    alignItems:'center',
    marginRight:4
  },

  reactionEmoji:{
    fontSize:15
  },

  reactionCount:{
    color:'#fff',
    fontSize:11,
    marginLeft:3,
    fontWeight:'700'
  },


  seenText:{
    color:'#777',
    fontSize:10,
    marginTop:3,
    marginHorizontal:4,
    alignSelf:'flex-end'
  },


  /* EMPTY */

  empty:{
    alignItems:'center',
    paddingTop:250
  },

  emptyTitle:{
    color:'#fff',
    fontSize:18,
    fontWeight:'700'
  },

  emptyText:{
    color:'#777',
    marginTop:5
  },


  /* =====================================================
     REPLY COMPOSER
     ===================================================== */

  replyComposer:{
    minHeight:62,
    maxHeight:82,

    backgroundColor:'#101010',

    borderTopWidth:1,
    borderTopColor:BORDER,

    flexDirection:'row',
    alignItems:'center'
  },

  replyComposerAccent:{
    width:4,
    height:44,
    backgroundColor:RED
  },

  replyComposerContent:{
    flex:1,
    minWidth:0,
    padding:8
  },

  replyComposerTitle:{
    color:RED,
    fontWeight:'800',
    fontSize:12
  },

  replyComposerText:{
    color:'#AAA',
    fontSize:12,
    flexShrink:1
  },

  replyClose:{
    width:44,
    height:44,
    justifyContent:'center',
    alignItems:'center'
  },

  replyCloseText:{
    color:'#999',
    fontSize:27
  },


  /* =====================================================
     INPUT
     ===================================================== */

  composer:{
    minHeight:64,
    padding:8,
    paddingHorizontal:10,
    flexDirection:'row',
    alignItems:'flex-end',
    backgroundColor:'#0C0C0C',
    borderTopWidth:1,
    borderTopColor:BORDER
  },

  input:{
    flex:1,
    maxHeight:120,
    minHeight:46,
    backgroundColor:'#171717',
    color:'#fff',
    borderRadius:23,
    paddingHorizontal:17,
    paddingTop:12,
    paddingBottom:10,
    fontSize:15,
    borderWidth:1,
    borderColor:BORDER
  },

  sendButton:{
    width:46,
    height:46,
    borderRadius:23,
    backgroundColor:RED,
    marginLeft:8,
    justifyContent:'center',
    alignItems:'center'
  },

  disabled:{
    opacity:.45
  },

  sendText:{
    color:'#fff',
    fontSize:20,
    fontWeight:'800'
  },


  /* =====================================================
     ACTION SHEET
     ===================================================== */

  backdrop:{
    flex:1,
    backgroundColor:'rgba(0,0,0,.72)',
    justifyContent:'flex-end'
  },

  actionSheet:{
    backgroundColor:'#151515',
    borderTopLeftRadius:24,
    borderTopRightRadius:24,
    padding:12
  },

  quickRow:{
    flexDirection:'row',
    justifyContent:'center',
    paddingVertical:5
  },

  quick:{
    width:49,
    height:49,
    borderRadius:25,
    backgroundColor:'#222',
    justifyContent:'center',
    alignItems:'center',
    marginHorizontal:4,
    borderWidth:1,
    borderColor:'#333'
  },

  quickText:{
    fontSize:25
  },

  plus:{
    backgroundColor:RED,
    borderColor:RED
  },

  plusText:{
    color:'#fff',
    fontSize:28
  },

  divider:{
    height:1,
    backgroundColor:'#292929',
    marginVertical:8
  },

  actionButton:{
    minHeight:50,
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:8
  },

  actionIcon:{
    width:36,
    height:36,
    borderRadius:18,
    backgroundColor:'#252525',
    justifyContent:'center',
    alignItems:'center',
    marginRight:12
  },

  dangerIcon:{
    backgroundColor:'rgba(225,29,42,.16)'
  },

  actionIconText:{
    color:'#fff',
    fontSize:18
  },

  dangerText:{
    color:RED
  },

  actionLabel:{
    color:'#fff',
    fontSize:15,
    fontWeight:'600'
  },


  /* =====================================================
     REACTION SHEET
     ===================================================== */

  sheet:{
    maxHeight:'70%',
    backgroundColor:'#151515',
    borderTopLeftRadius:24,
    borderTopRightRadius:24,
    padding:15
  },

  handle:{
    width:42,
    height:4,
    borderRadius:3,
    backgroundColor:'#555',
    alignSelf:'center',
    marginBottom:13
  },

  sheetTitle:{
    color:'#fff',
    fontSize:18,
    fontWeight:'800',
    marginBottom:12
  },

  grid:{
    flexDirection:'row',
    flexWrap:'wrap',
    justifyContent:'center'
  },

  emojiButton:{
    width:56,
    height:56,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:12,
    backgroundColor:'#202020',
    margin:4
  },

  bigEmoji:{
    fontSize:28
  },


  /* =====================================================
     REMOVE REACTION POPUP
     ===================================================== */

  popup:{
    alignSelf:'center',
    width:'84%',
    backgroundColor:'#161616',
    borderRadius:22,
    padding:22,
    alignItems:'center',
    borderWidth:1,
    borderColor:BORDER
  },

  popupEmoji:{
    fontSize:40
  },

  popupTitle:{
    color:'#fff',
    fontSize:16,
    fontWeight:'700',
    marginVertical:18
  },

  redButton:{
    width:'100%',
    height:48,
    borderRadius:12,
    backgroundColor:RED,
    justifyContent:'center',
    alignItems:'center'
  },

  redButtonText:{
    color:'#fff',
    fontWeight:'800'
  },

  cancelButton:{
    height:48,
    justifyContent:'center'
  },

  cancelText:{
    color:'#999'
  },


  /* =====================================================
     FORWARD
     ===================================================== */

  forwardSheet:{
    maxHeight:'82%',
    backgroundColor:'#151515',
    borderTopLeftRadius:24,
    borderTopRightRadius:24,
    padding:15
  },

  forwardHeader:{
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center'
  },

  close:{
    color:'#999',
    fontSize:30
  },

  friendScroll:{
    maxHeight:440
  },

  friendRow:{
    minHeight:66,
    flexDirection:'row',
    alignItems:'center',
    borderBottomWidth:1,
    borderBottomColor:'#222'
  },

  friendAvatar:{
    width:44,
    height:44,
    borderRadius:22,
    backgroundColor:RED,
    justifyContent:'center',
    alignItems:'center',
    overflow:'hidden'
  },

  friendAvatarImage:{
    width:'100%',
    height:'100%'
  },

  friendAvatarText:{
    color:'#fff',
    fontWeight:'800'
  },

  friendInfo:{
    flex:1,
    marginLeft:11,
    minWidth:0
  },

  friendName:{
    color:'#fff',
    fontSize:15,
    fontWeight:'700'
  },

  friendUsername:{
    color:'#777',
    fontSize:12
  },

  checkbox:{
    width:25,
    height:25,
    borderRadius:13,
    borderWidth:2,
    borderColor:'#555',
    justifyContent:'center',
    alignItems:'center'
  },

  checkboxSelected:{
    backgroundColor:RED,
    borderColor:RED
  },

  checkmark:{
    color:'#fff',
    fontWeight:'900'
  },

  forwardButton:{
    height:50,
    borderRadius:13,
    backgroundColor:RED,
    justifyContent:'center',
    alignItems:'center',
    marginTop:12
  },

  forwardText:{
    color:'#fff',
    fontWeight:'800'
  },

  noFriends:{
    paddingVertical:50,
    alignItems:'center'
  },

  noFriendsTitle:{
    color:'#fff',
    fontWeight:'700'
  }

});