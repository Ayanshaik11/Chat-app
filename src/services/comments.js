export function subscribeComments(postId, onChange, onError) {
  return onSnapshot(
    query(
      commentsRef(postId),
      orderBy('createdAt', 'asc')
    ),
    (snap) => {
      onChange(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    },
    (error) => {
      console.error(
        'Comments listener error:',
        error
      );

      onError?.(error);
    }
  );
}