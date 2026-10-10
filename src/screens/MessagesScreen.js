import React,{useMemo,useState}from'react';
import{FlatList,Pressable,TextInput,View}from'react-native';
import{Ionicons}from'@expo/vector-icons';
import{useAuth}from'../context/AuthContext';
import{useAppData}from'../context/AppDataContext';
import{useTheme}from'../context/SettingsContext';
import{chatIdFor}from'../services/chat';
import{isOnline,timeAgo,toMillis}from'../utils/helpers';
import Screen from'../components/Screen';
import Avatar from'../components/Avatar';
import EmptyState from'../components/EmptyState';
import T from'../components/T';
import{usePeerTyping}from'../utils/typing';

function PreviewText({typingValue,preview,unread,colors}){
  const typing=usePeerTyping(typingValue);
  return <T size={13} color={typing?'primary':unread?'text':'subtext'} weight={typing||unread?'medium':'regular'} numberOfLines={1}>{typing?'typing...':preview}</T>;
}

export default function MessagesScreen({navigation}){
  const{me}=useAuth();
  const{friends,chats}=useAppData();
  const{colors,fonts}=useTheme();
  const[text,setText]=useState('');

  const myId=me?.id||null;

  const rows=useMemo(()=>{
    if(!myId)return[];

    const q=text.trim().toLowerCase();

    return friends.filter(f=>{
      const name=f.name||f.displayName||'';
      const email=f.email||'';
      return !q||name.toLowerCase().includes(q)||email.toLowerCase().includes(q);
    }).map(friend=>{
      const friendId=friend.id||friend.uid;
      const chat=chats?.[chatIdFor(myId,friendId)]||null;

      // toMillis(null) returns "now", which pushed friends with no chat (and
      // just-sent messages with a pending timestamp) above real conversations.
      // So only convert real timestamps; no chat = 0 (bottom of the list).
      const lastMessageAt=chat?.lastMessageAt?toMillis(chat.lastMessageAt):0;
      const updatedAt=chat?.updatedAt?toMillis(chat.updatedAt):0;
      let lastActivity=Math.max(lastMessageAt,updatedAt);
      // message just sent: server timestamp not confirmed yet -> treat as newest
      if(!lastActivity&&chat?.lastMessage)lastActivity=Date.now();

      return{friend,chat,lastActivity};
    }).sort((a,b)=>b.lastActivity-a.lastActivity);
  },[friends,chats,text,myId]);

  const openChat=friend=>{
    const friendId=friend.id||friend.uid;
    navigation.navigate('Chat',{
      user:me,
      otherUser:{
        id:friendId,
        name:friend.name||friend.displayName||'User',
        displayName:friend.displayName||friend.name||'User',
        photoURL:friend.photoURL||friend.photoUrl||friend.profilePic||friend.avatar||'',
        email:friend.email||''
      }
    });
  };

  const renderItem=({item})=>{
    const{friend,chat}=item;
    const unread=chat?.unread?.[myId]||0;
    const friendId=friend.id||friend.uid;
    const preview=chat?.lastMessage?`${chat.lastSender===myId?'You: ':''}${chat.lastMessage}`:'Say hi 👋';

    return <Pressable onPress={()=>openChat(friend)} style={({pressed})=>({flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:10,gap:12,backgroundColor:pressed?colors.inputBg:'transparent'})}>
      <Avatar uri={friend.photoURL||friend.photoUrl||friend.profilePic||friend.avatar} name={friend.name||friend.displayName} size={54} online={isOnline(friend)}/>
      <View style={{flex:1,minWidth:0}}>
        <Pressable onPress={()=>navigation.navigate('UserProfile',{userId:friendId})} hitSlop={6} style={{alignSelf:'flex-start',maxWidth:'100%'}}>
          <T weight={unread?'bold':'semibold'} numberOfLines={1}>{friend.name||friend.displayName||'User'}</T>
        </Pressable>
        <PreviewText typingValue={chat?.typing?.[friendId]} preview={preview} unread={unread}/>
      </View>
      <View style={{alignItems:'flex-end',gap:6}}>
        {item.lastActivity>0&&chat?.lastMessage&&<T size={11} color="subtext">{timeAgo(chat?.lastMessageAt||chat?.updatedAt)}</T>}
        {unread>0&&<View style={{backgroundColor:colors.primary,minWidth:20,height:20,borderRadius:10,paddingHorizontal:5,alignItems:'center',justifyContent:'center'}}>
          <T size={11} weight="bold" color="#fff">{unread}</T>
        </View>}
      </View>
    </Pressable>;
  };

  return <Screen>
    <View style={{paddingHorizontal:16,paddingTop:10,paddingBottom:8}}>
      <T weight="bold" size={24}>Messages</T>
      <View style={{flexDirection:'row',alignItems:'center',backgroundColor:colors.inputBg,borderRadius:14,paddingHorizontal:12,marginTop:12,height:44,gap:8}}>
        <Ionicons name="search" size={19} color={colors.subtext}/>
        <TextInput value={text} onChangeText={setText} placeholder="Search friends" placeholderTextColor={colors.subtext} style={{flex:1,fontFamily:fonts.regular,fontSize:14,color:colors.text}}/>
      </View>
    </View>

    <FlatList
      data={rows}
      keyExtractor={item=>item.friend.id||item.friend.uid}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      ListEmptyComponent={<EmptyState title="No messages" subtitle="Start a conversation with a friend."/>}
    />
  </Screen>;
}