// PL-02 TK-1 Tester · S-6 控制台只读检查片段（r2，ES5）
// 用法：在 Claude in Chrome 的 javascript_tool 里原样粘贴「片段 E」或「片段 F」那一个 IIFE 执行。
// 只读：只读 DOM、jQuery 内部事件表、RequireJS 已加载模块表；不调用页面函数、不改任何东西。
// 本文件只是片段的原样副本（与 browser-cases.md S-6 节一致），用 node --check 做语法检查。

// ===== 片段 E：公共弹窗 #addNewListModal 快照（打开态、关闭态都用它） =====
(function(){
  var m=document.getElementById('addNewListModal');
  if(!m) return 'missing';
  var $m=$(m), btn=document.getElementById('addNewListBtn'), nm=$('#addNewLName'), ds=$('#addNewLDesc');
  // 把字符串压成「长度:哈希」，只用于前后比较（data 原文含查询串，浏览器工具会拦截原文输出）
  function h32(s){ if(s==null) return null; s=String(s); var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))|0; } return s.length+':'+(h>>>0).toString(16); }
  // 第 i 个 .content-box 的文字（合并空白；&nbsp; 也算空白）
  function rowText(i){ return $.trim($m.find('.modal-body .content-box').eq(i).text()).replace(/\s+/g,' '); }
  // 沿「确定」按钮的祖先链数 jQuery 事件处理：直接绑在按钮上的 + 委托到按钮的（selector 能匹配按钮）
  function handlers(){
    var out={}, chain=[], n;
    for(n=btn; n; n=n.parentNode){ chain.push(n); }
    for(var c=0;c<chain.length;c++){
      var ev=$._data(chain[c],'events'); if(!ev) continue;
      for(var t in ev){ for(var i=0;i<ev[t].length;i++){ var hd=ev[t][i], hit=false;
        if(chain[c]===btn && !hd.selector){ hit=true; }
        else if(hd.selector){ try{ hit=$(btn).is(hd.selector); }catch(e){ hit=false; } }
        if(hit){ var who=(chain[c]===btn)?'self':(chain[c]===document?'document':(chain[c].id?('#'+chain[c].id):chain[c].nodeName));
          var k=who+'|'+t+'.'+(hd.namespace||'')+'|'+(hd.selector||''); out[k]=(out[k]||0)+1; } } } }
    return out;
  }
  // 按钮上的 jQuery data（不是 HTML 属性）；序列化失败时只记一个标记
  var jq; try{ jq=h32(JSON.stringify($(btn).data())); }catch(e){ jq='unserializable'; }
  return JSON.stringify({
    count: document.querySelectorAll('#addNewListModal').length,
    visible: $m.is(':visible'), cls: m.className,
    title: $.trim($('#addNewListTitle').text()),
    rows: [rowText(0), rowText(1), rowText(2)],
    sysText: $.trim($m.find('.add-newl-type').text()),
    nameVal: nm.val(), namePh: nm.attr('placeholder'), nameMax: nm.attr('maxlength'), nameOninput: nm.attr('oninput'),
    descVal: ds.val(), descPh: ds.attr('placeholder'), descMax: ds.attr('maxlength'), descOninput: ds.attr('oninput'),
    footerBtns: $m.find('.modal-footer button').map(function(){ return $.trim($(this).text())+(this.disabled?'(灰)':''); }).get(),
    hasClose: $m.find('.modal-header button.close').length,
    hasBeizhu: /备\s*注/.test($m.text()), hasMiaoshu: $m.text().indexOf('描述')>=0,
    btnDataAttr: h32($(btn).attr('data')), btnJqData: jq,
    btnHandlers: handlers(),
    styleSig: [$m.css('width'), nm.css('width'), $m.find('.content-box label').first().css('font-size')],
    textHash: h32($.trim($m.text()).replace(/\s+/g,' ')),
    text: $.trim($m.text()).replace(/\s+/g,' ')
  });
})();

// ===== 片段 F：浏览器里实际加载的 processManage 模块有没有 listModal =====
(function(){
  var d=window.require&&require.s&&require.s.contexts&&require.s.contexts._&&require.s.contexts._.defined;
  if(!d) return 'no-requirejs';
  var m=d['processManage'];
  return JSON.stringify({loaded:!!m, keys:m?Object.keys(m):null, hasListModal:!!(m&&m.listModal)});
})();
