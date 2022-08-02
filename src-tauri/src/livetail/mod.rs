pub struct LiveTailWorker {
  thread: Option<JoinHandle<WorkerData>>,
}

impl LiveTailWorker {
  pub fn new() -> Self {
    Self { thread: None }
  }

  pub fn run(&mut self) {
    // Create `WorkerData` and copy/clone whatever is needed from `self`
    let mut data = WorkerData {};

    self.thread = Some(thread::spawn(move || {
      let mut i = 0;
      loop {
        data.call();
        i = 1 + i;
        if i > 5 {
          // Return `data` so we get in through `join()`
          return data;
        }
      }
    }));
  }

  pub fn stop(&mut self) -> Option<thread::Result<WorkerData>> {
    if let Some(handle) = self.thread.take() {
      Some(handle.join())
    } else {
      None
    }
  }
}
