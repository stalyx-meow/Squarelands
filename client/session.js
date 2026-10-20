// Invalidating the session prevents responses from earlier logins/logouts from winning.
export class SessionRequests {
  generation=0;
  pending=null;
  invalidate(){this.generation++;this.pending=null;}
  current(version){return version===this.generation;}
  load(loader){const generation=this.generation;if(this.pending?.generation===generation)return this.pending.promise;
    const promise=Promise.resolve().then(loader).then(value=>({generation,value}),error=>({generation,error}));
    this.pending={generation,promise};promise.finally(()=>{if(this.pending?.promise===promise)this.pending=null;});return promise;
  }
}
